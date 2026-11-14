"""
CLPS Lunar Mission Browser — Real NASA SPICE & LOLA DEM Telemetry Generator
============================================================================
Authoritative offline ephemeris, global slope (SLDEM2015), and Diviner GCP
thermal generator for NASA competition.
Calculates high-precision topocentric Sun & Earth elevation and azimuth,
intersects with local LOLA DEM horizon profiles for polar sites, extracts
bolometric temperature (tbol) memory-efficiently from Diviner GCP .tab files,
and generates verified 30-day mission telemetry (720 hours) starting Jan 1, 2026 UTC.
"""

import csv
import json
import math
import os
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image
import rasterio
from rasterio.warp import transform
from skyfield.api import load
from skyfield.planetarylib import PlanetaryConstants

from generate_multi_site_telemetry import get_water_ice_prob

# Moon physical radius (meters)
MOON_RADIUS_METERS = 1737400.0
SOLAR_CONSTANT = 1361.0  # ASTM E490 at 1 AU (W/m^2)
SOLAR_SEMI_DIAMETER_DEG = 0.26  # Angular radius of Sun as seen from Moon

TOTAL_HOURS = 720  # 30 days
START_YEAR = 2026
START_MONTH = 1
START_DAY = 1
START_HOUR = 0

# 8 Authoritative Polar Landing Sites
POLAR_SITES = [
    {
        "id": "shackleton",
        "name": "Shackleton Crater",
        "lat": -89.9,
        "lon": 0.0,
        "heightmap": "shackleton_heightmap.png",
        "elev_range": 4000.0,
        "pixel_scale": 20.0,
        "center": (493, 419),
        "is_polar": True,
        "description": "Lunar South Pole rim with near-permanent solar illumination peaks and cold trap craters.",
    },
    {
        "id": "malapert",
        "name": "Malapert Mountain",
        "lat": -86.0,
        "lon": -2.9,
        "heightmap": "malapert_heightmap.png",
        "elev_range": 5000.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "High-elevation massif with continuous line-of-sight communication to Earth.",
    },
    {
        "id": "de_gerlache",
        "name": "de Gerlache Rim",
        "lat": -88.5,
        "lon": -87.1,
        "heightmap": "de_gerlache_heightmap.png",
        "elev_range": 3500.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "Connecting ridge between de Gerlache and Shackleton, target for robotic landers.",
    },
    {
        "id": "mons_mouton",
        "name": "Mons Mouton",
        "lat": -85.5,
        "lon": 32.7,
        "heightmap": "mons_mouton_heightmap.png",
        "elev_range": 3000.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "Broad elevated plateau with high solar visibility adjacent to South Pole-Aitken basin.",
    },
    {
        "id": "nobile_rim",
        "name": "Nobile Rim",
        "lat": -85.4,
        "lon": 53.5,
        "heightmap": "nobile_rim_heightmap.png",
        "elev_range": 3500.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "VIPER rover exploration target with permanently shadowed regions and volatile deposits.",
    },
    {
        "id": "haworth",
        "name": "Haworth Crater",
        "lat": -87.4,
        "lon": -4.0,
        "heightmap": "haworth_heightmap.png",
        "elev_range": 4500.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "Deep permanently shadowed crater floor harboring significant lunar water ice deposits.",
    },
    {
        "id": "cabeus_b",
        "name": "Cabeus B",
        "lat": -86.0,
        "lon": -42.0,
        "heightmap": "cabeus_b_heightmap.png",
        "elev_range": 2500.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "High-interest scientific site near LCROSS impact zone rich in subsurface hydrogen.",
    },
    {
        "id": "slater_plain",
        "name": "Slater Plain",
        "lat": -86.0,
        "lon": -20.0,
        "heightmap": "slater_plain_heightmap.png",
        "elev_range": 1500.0,
        "pixel_scale": 20.0,
        "center": (512, 512),
        "is_polar": True,
        "description": "Relatively smooth transit corridor between Faustini and Amundsen craters.",
    },
]


def locate_dataset_file(*filenames: str) -> Path | None:
    base_dir = Path(__file__).resolve().parent
    for fname in filenames:
        candidates = [
            base_dir / "raw_data" / fname,
            base_dir / fname,
            Path("raw_data") / fname,
            Path(fname),
        ]
        for c in candidates:
            if c.exists():
                return c.resolve()
    return None


def get_band_for_lat(lat: float) -> str:
    lat = max(-90.0, min(90.0, lat))
    if lat >= 80.0: return "80n90n"
    elif lat >= 70.0: return "70n80n"
    elif lat >= 60.0: return "60n70n"
    elif lat >= 50.0: return "50n60n"
    elif lat >= 40.0: return "40n50n"
    elif lat >= 30.0: return "30n40n"
    elif lat >= 20.0: return "20n30n"
    elif lat >= 10.0: return "10n20n"
    elif lat >= 0.0: return "00n10n"
    elif lat >= -10.0: return "10s00s"
    elif lat >= -20.0: return "20s10s"
    elif lat >= -30.0: return "30s20s"
    elif lat >= -40.0: return "40s30s"
    elif lat >= -50.0: return "50s40s"
    elif lat >= -60.0: return "60s50s"
    elif lat >= -70.0: return "70s60s"
    elif lat >= -80.0: return "80s70s"
    else: return "90s80s"


def load_all_sites(base_dir: Path) -> list[dict]:
    sites = list(POLAR_SITES)
    csv_file = base_dir / "raw_data" / "moon-sites.csv"
    if csv_file.exists():
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                lat_str = (r.get("latitude") or "").strip()
                lon_str = (r.get("longitude") or "").strip()
                if not lat_str or not lon_str:
                    continue
                try:
                    lat = float(lat_str)
                    lon = float(lon_str)
                except ValueError:
                    continue

                slug = (r.get("slug") or "").strip()
                site_id = slug.replace("-", "_") if slug else f"site_{len(sites)}"
                if any(s["id"] == site_id for s in sites):
                    continue

                name = (r.get("name") or site_id).strip()
                desc = (r.get("site_name") or r.get("outcome") or "").strip()
                sites.append({
                    "id": site_id,
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "is_polar": False,
                    "description": desc,
                })
        print(f"Loaded {len(sites)} total sites ({len(POLAR_SITES)} polar + {len(sites) - len(POLAR_SITES)} global)")
    return sites


def extract_global_temperatures(sites: list[dict], gcp_dir: Path) -> dict[str, float | None]:
    """
    Memory-efficient extraction of max bolometric temperature (tbol) from Diviner GCP files:
    1. Groups sites by latitude band.
    2. Streams each band file in chunks of 100,000 rows with pandas.read_csv.
    3. Finds the closest clon/clat bin, filters out -9999 / invalid readings,
       and extracts the maximum tbol across all local solar times.
    """
    band_sites: dict[str, list[dict]] = {}
    for s in sites:
        band = get_band_for_lat(s["lat"])
        band_sites.setdefault(band, []).append(s)

    results: dict[str, float | None] = {}

    for band, b_sites in band_sites.items():
        fname = f"global_cumul_avg_cyl_{band}_002.tab"
        fpath = gcp_dir / fname

        if not fpath.exists() or fpath.stat().st_size < 1000:
            print(f"   [Thermal] Band file {fname} not downloaded yet. Setting {len(b_sites)} sites to null.")
            for s in b_sites:
                results[s["id"]] = None
            continue

        print(f"   [Thermal] Scanning {fname} for {len(b_sites)} site(s) using chunksize=100000...")
        targets = []
        for s in b_sites:
            lat = s["lat"]
            lon = s["lon"]
            if lon > 180.0:
                lon = lon - 360.0
            targets.append({
                "id": s["id"],
                "lat": lat,
                "lon": lon,
                "best_dist": 999.0,
                "max_tbol": None,
            })

        try:
            for chunk in pd.read_csv(
                fpath,
                sep=",",
                skipinitialspace=True,
                chunksize=100000,
                usecols=["clon", "clat", "tbol"],
                on_bad_lines="skip"
            ):
                for target in targets:
                    t_lat = target["lat"]
                    t_lon = target["lon"]
                    d_lon_approx = np.abs(chunk["clon"] - t_lon)
                    d_lon_approx = np.minimum(d_lon_approx, 360.0 - d_lon_approx)
                    mask = (np.abs(chunk["clat"] - t_lat) <= 0.8) & (d_lon_approx <= 0.8)
                    sub = chunk[mask]
                    if sub.empty:
                        continue
                    valid_sub = sub[(sub["tbol"] != -9999) & (sub["tbol"] > 0)]
                    if valid_sub.empty:
                        continue
                    d_lon = np.abs(valid_sub["clon"] - t_lon)
                    d_lon = np.minimum(d_lon, 360.0 - d_lon)
                    dist = np.sqrt((valid_sub["clat"] - t_lat)**2 + d_lon**2)
                    min_d = float(dist.min())
                    if min_d < target["best_dist"] - 1e-4:
                        target["best_dist"] = min_d
                        target["max_tbol"] = float(valid_sub[dist == min_d]["tbol"].max())
                    elif abs(min_d - target["best_dist"]) <= 1e-4:
                        cand_max = float(valid_sub[dist == min_d]["tbol"].max())
                        if target["max_tbol"] is None or cand_max > target["max_tbol"]:
                            target["max_tbol"] = cand_max
        except Exception as e:
            print(f"   [Thermal Error] Error scanning {fpath.name}: {e}")

        for target in targets:
            val = round(target["max_tbol"], 1) if target["max_tbol"] is not None else None
            results[target["id"]] = val
            print(f"      • {target['id']:<25} ({target['lat']:+.2f}°, {target['lon']:+.2f}°) -> maxSurfaceTempK = {val} K")

    return results


_GLOBAL_SLOPE_SRC = None


def get_global_slope(lat: float, lon: float, site_id: str | None = None) -> float | None:
    """
    Extracts surface slope in degrees using rasterio on SLDEM2015 64PPD global map,
    falling back to local high-resolution LOLA DEMs for polar sites.
    """
    global _GLOBAL_SLOPE_SRC
    if _GLOBAL_SLOPE_SRC is None:
        slope_files = [
            locate_dataset_file("SLDEM2015_64_SL_90S_90N_000_360.LBL"),
            locate_dataset_file("SLDEM2015_SLOPE_64PPD.TIF", "SLDEM2015_SLOPE_64PPD.tif"),
        ]
        for sf in slope_files:
            if sf and sf.exists():
                try:
                    _GLOBAL_SLOPE_SRC = rasterio.open(sf)
                    break
                except Exception:
                    pass

    if _GLOBAL_SLOPE_SRC is not None:
        try:
            src = _GLOBAL_SLOPE_SRC
            geog_crs = rasterio.crs.CRS.from_string(f"+proj=longlat +R={MOON_RADIUS_METERS} +no_defs")
            xs, ys = transform(geog_crs, src.crs, [lon], [lat])
            r, c = src.index(xs[0], ys[0])
            # Clamp index to prevent floating point boundary edge errors
            r = max(0, min(r, src.height - 1))
            c = max(0, min(c, src.width - 1))
            val = src.read(1, window=rasterio.windows.Window(c, r, 1, 1))[0, 0]
            if not (val is None or math.isnan(val) or val < 0 or val > 90):
                return round(float(val), 2)
        except Exception:
            pass

    # High-resolution local DEM fallbacks for polar sites
    dem_candidates = {
        "shackleton": "Site04_final_adj_5mpp_surf.tif",
        "malapert": "Site07_final_adj_5mpp_surf.tif",
        "de_gerlache": "Site23_final_adj_5mpp_surf.tif",
    }
    base_dir = Path(__file__).resolve().parent
    local_dem_name = dem_candidates.get(site_id)
    if local_dem_name:
        local_dem = base_dir / local_dem_name
        if local_dem.exists():
            try:
                with rasterio.open(local_dem) as src:
                    r, c = src.height // 2, src.width // 2
                    win = rasterio.windows.Window(c - 20, r - 20, 41, 41)
                    data = src.read(1, window=win).astype(float)
                    dy, dx = np.gradient(data, 5.0)
                    slope = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))
                    return round(float(np.nanmean(slope)), 2)
            except Exception:
                pass
    return None


def get_illumination(lat: float, lon: float, is_polar: bool = True, default_pct: float | None = None) -> float | None:
    """
    Returns average solar illumination percentage:
    - Non-polar global sites: None (null in JSON).
    - Polar sites: LOLA DEM horizon profile ray-traced percentage.
    """
    if not is_polar:
        return None

    visib_file = locate_dataset_file("AVGVISIB_75S_120M_201608.IMG", "AVGVISIB_75S_120M_201608.img")
    if visib_file:
        try:
            with rasterio.open(visib_file) as src:
                geog_crs = rasterio.crs.CRS.from_string(f"+proj=longlat +R={MOON_RADIUS_METERS} +no_defs")
                xs, ys = transform(geog_crs, src.crs, [lon], [lat])
                row, col = src.index(xs[0], ys[0])
                if 0 <= row < src.height and 0 <= col < src.width:
                    val = src.read(1, window=rasterio.windows.Window(col, row, 1, 1))[0, 0]
                    if not (val is None or math.isnan(val) or val < 0):
                        return round(float(val), 2)
        except Exception:
            pass

    if default_pct is not None:
        return round(float(default_pct), 2)
    return None


def compute_terrain_horizon_mask(
    heightmap_path: Path,
    elev_range_m: float,
    pixel_scale_m: float,
    center_coords: tuple[int, int],
    observer_mast_height_m: float = 2.0,
) -> tuple[np.ndarray, float]:
    """
    Computes a 360-degree radial horizon profile (in degrees) from a DEM heightmap,
    accounting for Moon spherical curvature.
    """
    if not heightmap_path.exists():
        raise FileNotFoundError(f"Heightmap not found: {heightmap_path}")

    im = Image.open(heightmap_path).convert("L")
    arr = np.array(im, dtype=np.float32)
    h, w = arr.shape
    cy, cx = center_coords

    elev = (arr / 255.0) * elev_range_m
    z0 = float(elev[cy, cx] + observer_mast_height_m)

    max_radius_px = int(min(cx, cy, w - 1 - cx, h - 1 - cy)) - 2
    max_radius_px = max(max_radius_px, 200)
    r_steps = np.arange(1, max_radius_px)
    dist_m = r_steps * pixel_scale_m
    curv_drop = (dist_m**2) / (2.0 * MOON_RADIUS_METERS)

    horizon_mask = np.zeros(360, dtype=np.float32)

    for az_deg in range(360):
        rad = np.radians(az_deg)
        xs = np.clip(np.round(cx + r_steps * np.sin(rad)).astype(int), 0, w - 1)
        ys = np.clip(np.round(cy - r_steps * np.cos(rad)).astype(int), 0, h - 1)
        z_ray = elev[ys, xs]
        angles = np.degrees(np.arctan2(z_ray - z0 - curv_drop, dist_m))
        horizon_mask[az_deg] = float(np.max(angles))

    return horizon_mask, z0


def main():
    base_dir = Path(__file__).resolve().parent
    public_dir = base_dir / "public"
    clps_app_pub = base_dir / "clps-app" / "public"
    heightmaps_dir = clps_app_pub / "heightmaps"
    gcp_dir = base_dir / "raw_data" / "diviner_gcp"

    public_dir.mkdir(parents=True, exist_ok=True)
    clps_app_pub.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("CLPS Lunar Mission Browser — Real NASA SPICE & LOLA DEM Telemetry Generator")
    print("=" * 80)
    print(f"Mission UTC Epoch : {START_YEAR}-{START_MONTH:02d}-{START_DAY:02d} {START_HOUR:02d}:00:00Z")
    print(f"Simulation Window : {TOTAL_HOURS} Hours (30 Days at 1-Hour Step)")

    # 1. Load All Sites (Polar + Global moon-sites.csv)
    sites = load_all_sites(base_dir)

    # 2. Memory-efficient Global Thermal Extraction via Diviner GCP
    print("\n[1/4] Extracting Bolometric Surface Temperatures from Diviner GCP (chunksize=100000)...")
    temp_lookup = extract_global_temperatures(sites, gcp_dir)

    # 3. Load Ephemeris & Frame Orientation
    print("\n[2/4] Loading NASA JPL DE421 Ephemeris and Timescales...")
    ts = load.timescale()
    eph = load(str(base_dir / "de421.bsp"))
    moon = eph["moon"]
    sun = eph["sun"]
    earth = eph["earth"]

    print("\n[3/4] Loading NAIF Lunar Orientation Kernels (MOON_PA_DE421)...")
    pc = PlanetaryConstants()
    pc.read_text(load(str(base_dir / "pck00010.tpc")))
    pc.read_text(load(str(base_dir / "moon_080317.tf")))
    pc.read_binary(load(str(base_dir / "moon_pa_de421_1900-2050.bpc")))
    moon_frame = pc.build_frame_named("MOON_PA_DE421")

    # 4. Generate Telemetry Datasets
    print("\n[4/4] Generating Ephemeris & Telemetry Datasets...")
    start_utc = datetime(START_YEAR, START_MONTH, START_DAY, START_HOUR, 0, 0, tzinfo=timezone.utc)
    summary_results = []

    for site in sites:
        sid = site["id"]
        name = site["name"]
        lat = site["lat"]
        lon = site["lon"]
        is_polar = site.get("is_polar", False)

        print(f"\n-> Processing {name} ({sid}) [{lat:+.2f}°, {lon:+.2f}°] {'(POLAR)' if is_polar else '(GLOBAL)'}...")

        # Terrain Horizon Mask: Polar sites use DEM ray-tracing, global sites use 0.0 deg tangent plane
        if is_polar and "heightmap" in site:
            hmap_file = heightmaps_dir / site["heightmap"]
            h_mask, z0_elev = compute_terrain_horizon_mask(
                hmap_file,
                elev_range_m=site["elev_range"],
                pixel_scale_m=site["pixel_scale"],
                center_coords=site["center"],
            )
            print(f"   LOLA Horizon Mask: min={h_mask.min():.2f}°, max={h_mask.max():.2f}°, mean={h_mask.mean():.2f}°")
        else:
            h_mask = np.zeros(360, dtype=np.float32)

        # Topocentric Observer on Lunar Surface
        observer_loc = pc.build_latlon_degrees(moon_frame, latitude_degrees=lat, longitude_degrees=lon)
        site_observer = moon + observer_loc

        # Surface Physical Properties
        max_temp = temp_lookup.get(sid)
        avg_slope = get_global_slope(lat, lon, site_id=sid)
        print(f"   Slope: {avg_slope}° | Max Temp: {max_temp} K")

        data_points = []
        battery_level = 100.0
        sun_hours_count = 0
        comms_hours_count = 0
        total_irradiance = 0.0

        for h in range(TOTAL_HOURS):
            dt_utc = start_utc + timedelta(hours=h)
            t = ts.utc(dt_utc.year, dt_utc.month, dt_utc.day, dt_utc.hour, 0, 0)

            alt_sun, az_sun, _ = site_observer.at(t).observe(sun).apparent().altaz()
            alt_earth, az_earth, _ = site_observer.at(t).observe(earth).apparent().altaz()

            sun_elev = float(alt_sun.degrees)
            sun_az = float(az_sun.degrees) % 360.0

            earth_elev = float(alt_earth.degrees)
            earth_az = float(az_earth.degrees) % 360.0

            h_sun_terrain = float(h_mask[int(sun_az) % 360])
            h_earth_terrain = float(h_mask[int(earth_az) % 360])

            sun_visible = (sun_elev + SOLAR_SEMI_DIAMETER_DEG) > h_sun_terrain
            earth_visible = earth_elev > h_earth_terrain

            if sun_visible:
                sun_hours_count += 1
                eff_elev = max(0.05, sun_elev - h_sun_terrain)
                solar_irradiance = SOLAR_CONSTANT * math.sin(math.radians(eff_elev))
            else:
                solar_irradiance = 0.0

            total_irradiance += solar_irradiance

            # Battery Model: 10 m^2 solar array at 30% efficiency, 50W base hotel load
            power_gen = solar_irradiance * 10.0 * 0.3
            battery_delta = power_gen - 50.0
            battery_level += (battery_delta / 1000.0) * 100.0
            battery_level = max(0.0, min(100.0, battery_level))

            # Comms Model
            if not earth_visible:
                comms_status = "BLACKOUT"
                data_rate = 0.0
            else:
                comms_hours_count += 1
                margin = earth_elev - h_earth_terrain
                if margin < 2.0:
                    comms_status = "DEGRADED"
                    data_rate = 5.0
                else:
                    comms_status = "NOMINAL"
                    data_rate = 100.0 * max(0.0, math.sin(math.radians(earth_elev)))

            month_abbr = dt_utc.strftime("%b")
            time_label = f"{month_abbr} {dt_utc.day:02d}, {dt_utc.hour:02d}:00"
            iso_utc = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

            data_points.append({
                "time": time_label,
                "utc": iso_utc,
                "sunElevation": round(sun_elev, 2),
                "sunAzimuth": round(sun_az, 1),
                "earthElevation": round(earth_elev, 2),
                "earthAzimuth": round(earth_az, 1),
                "solarIrradiance": round(solar_irradiance, 1),
                "batteryLevel": round(battery_level, 1),
                "dataRate": round(data_rate, 1),
                "commsStatus": comms_status,
                "sunVisible": bool(sun_visible),
                "earthVisible": bool(earth_visible),
                "terrainHorizon": round(h_sun_terrain, 2) if is_polar else 0.0,
                "maxSurfaceTempK": max_temp,
                "averageSlopeDeg": avg_slope,
                "illuminationPct": None,
            })

        avg_irradiance = total_irradiance / TOTAL_HOURS
        sun_percent = (sun_hours_count / TOTAL_HOURS) * 100.0
        comms_percent = (comms_hours_count / TOTAL_HOURS) * 100.0

        # Illumination: Polar sites use ray-traced percentage, non-polar global sites use SPICE ephemeris sun percent
        illum_pct = get_illumination(lat, lon, is_polar=is_polar, default_pct=sun_percent)
        if illum_pct is None:
            illum_pct = round((sun_hours_count / TOTAL_HOURS) * 100.0, 2)
        water_ice_val = get_water_ice_prob(lat, lon)
        for pt in data_points:
            pt["illuminationPct"] = illum_pct
            pt["waterIcePct"] = water_ice_val

        output_payload = {
            "site": name,
            "id": sid,
            "coordinates": {"lat": lat, "lon": lon},
            "isPolar": is_polar,
            "elevationDatum": "LOLA SLDEM2015 64PPD / LOLA DEM",
            "ephemerisKernel": "NASA JPL DE421 / MOON_PA_DE421",
            "summary": {
                "totalHours": TOTAL_HOURS,
                "sunHours": sun_hours_count,
                "sunPercent": round(sun_percent, 1),
                "commsHours": comms_hours_count,
                "commsUptimePercent": round(comms_percent, 1),
                "avgSolarIrradiance": round(avg_irradiance, 1),
                "minSunElevation": round(min(d["sunElevation"] for d in data_points), 2),
                "maxSunElevation": round(max(d["sunElevation"] for d in data_points), 2),
                "minEarthElevation": round(min(d["earthElevation"] for d in data_points), 2),
                "maxEarthElevation": round(max(d["earthElevation"] for d in data_points), 2),
                "maxSurfaceTempK": max_temp,
                "averageSlopeDeg": avg_slope,
                "illuminationPct": illum_pct,
                "waterIcePct": water_ice_val,
            },
            "data": data_points,
        }

        # Write output files
        out_file = clps_app_pub / f"{sid}_data.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, indent=2)

        mirror_file = public_dir / f"{sid}_data.json"
        with open(mirror_file, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, indent=2)

        summary_results.append({
            "name": name,
            "id": sid,
            "isPolar": is_polar,
            "sunHours": sun_hours_count,
            "sunPercent": sun_percent,
            "commsPercent": comms_percent,
            "avgSolar": avg_irradiance,
            "temp": max_temp,
            "slope": avg_slope,
        })
        print(f"   ✓ Successfully written {out_file.name}")

    print("\n" + "=" * 90)
    print("🎉 GLOBAL LUNAR EPHEMERIS GENERATION COMPLETE")
    print("=" * 90)
    print(f"{'Site Name':<28} | {'Type':<7} | {'Slope':<7} | {'Max Temp':<9} | {'Sun Hours':<11} | {'Comms Uptime':<13}")
    print("-" * 90)
    for r in summary_results[:20]:
        t_str = f"{r['temp']:.1f} K" if r['temp'] is not None else "null"
        s_str = f"{r['slope']:.2f}°" if r['slope'] is not None else "null"
        p_str = "POLAR" if r["isPolar"] else "GLOBAL"
        print(f"{r['name']:<28} | {p_str:<7} | {s_str:<7} | {t_str:<9} | {r['sunHours']:3d}h ({r['sunPercent']:4.1f}%) | {r['commsPercent']:5.1f}%")
    if len(summary_results) > 20:
        print(f"... and {len(summary_results) - 20} more global sites.")
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
