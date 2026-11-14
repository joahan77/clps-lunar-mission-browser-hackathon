import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE_URL = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp"
DEST_DIR = Path("raw_data/diviner_gcp")
DEST_DIR.mkdir(parents=True, exist_ok=True)

# Priority bands: 90s80s (Shackleton) first, then others
BANDS = [
    "90s80s", "10s00s", "20s10s", "30s20s", "40s30s", "50s40s", "60s50s", "70s60s", "80s70s",
    "10n20n", "20n30n", "30n40n", "40n50n", "50n60n", "60n70n", "70n80n", "80n90n"
]

EXPECTED_SIZE = 156211313

def download_band(band):
    fname = f"global_cumul_avg_cyl_{band}_002.tab"
    out_path = DEST_DIR / fname
    temp_path = DEST_DIR / f"{fname}.part"

    if out_path.exists() and out_path.stat().st_size >= EXPECTED_SIZE:
        print(f"[SKIP] {fname} already fully downloaded ({out_path.stat().st_size} bytes)")
        return band, True

    url = f"{BASE_URL}/{fname}"
    print(f"[START] {band}: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(temp_path, "wb") as f:
            downloaded = 0
            while True:
                chunk = resp.read(1024 * 512)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

        # Rename to final
        temp_path.replace(out_path)
        print(f"[SUCCESS] {fname} downloaded ({out_path.stat().st_size} bytes)")
        return band, True
    except Exception as e:
        print(f"[ERROR] {fname}: {e}")
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        return band, False

if __name__ == "__main__":
    print(f"Starting parallel download of {len(BANDS)} Diviner GCP .tab files...")
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(download_band, b): b for b in BANDS}
        for future in as_completed(futures):
            b, success = future.result()
            print(f"Finished {b}: {'OK' if success else 'FAILED'}")
    print("All downloads finished!")
