"""
Generate 1024x1024 grayscale terrain heightmaps for global lunar landing sites
using LOLA / SLDEM2015 global 64 PPD elevation map and rasterio windowed reads.
"""

import os
import rasterio
from rasterio.windows import Window
import numpy as np
from PIL import Image

def generate_heightmaps():
    dem_path = os.path.join('raw_data', 'SLDEM2015_64PPD.TIF')
    if not os.path.exists(dem_path):
        jp2_path = os.path.join('raw_data', 'LDEM_64.JP2')
        if os.path.exists(jp2_path):
            try:
                os.link(jp2_path, dem_path)
            except Exception:
                dem_path = jp2_path

    print(f"Opening global DEM dataset: {dem_path}")

    sites = {
        'apollo_11': (0.674, 23.473),
        'apollo_17': (20.190, 30.772),
        'change_4': (-45.5, 177.6),
        'luna_9': (7.13, -64.37),
        'chandrayaan_3': (-69.37, 32.32),
        'im1_odysseus': (-80.13, 1.44),
    }

    output_dirs = [
        os.path.join('public', 'heightmaps'),
        os.path.join('clps-app', 'public', 'heightmaps')
    ]

    for d in output_dirs:
        os.makedirs(d, exist_ok=True)

    window_size = 1024
    half_w = window_size // 2

    with rasterio.open(dem_path) as src:
        width = src.width
        height = src.height
        print(f"Dataset dimensions: {width} x {height}, CRS: {src.crs}")

        for site_id, (lat, lon) in sites.items():
            row, col = src.index(lon, lat)
            
            row_start = int(round(row - half_w))
            col_start = int(round(col - half_w))

            # Clamp row within raster boundaries
            if row_start < 0:
                row_start = 0
            elif row_start + window_size > height:
                row_start = height - window_size

            # Check column wrap-around (global equirectangular raster)
            if col_start >= 0 and col_start + window_size <= width:
                # Normal window within boundaries
                win = Window(col_start, row_start, window_size, window_size)
                patch = src.read(1, window=win).astype(np.float32)
            elif col_start + window_size > width:
                # Crosses the eastern antimeridian (wraps to western edge)
                part1_w = width - col_start
                part2_w = window_size - part1_w
                win1 = Window(col_start, row_start, part1_w, window_size)
                win2 = Window(0, row_start, part2_w, window_size)
                d1 = src.read(1, window=win1).astype(np.float32)
                d2 = src.read(1, window=win2).astype(np.float32)
                patch = np.hstack([d1, d2])
            else:
                # Crosses western edge (col_start < 0)
                part1_w = -col_start
                part2_w = window_size - part1_w
                win1 = Window(width + col_start, row_start, part1_w, window_size)
                win2 = Window(0, row_start, part2_w, window_size)
                d1 = src.read(1, window=win1).astype(np.float32)
                d2 = src.read(1, window=win2).astype(np.float32)
                patch = np.hstack([d1, d2])

            min_elev = float(np.min(patch))
            max_elev = float(np.max(patch))
            elev_range = max_elev - min_elev

            if elev_range > 0:
                normalized = ((patch - min_elev) / elev_range * 255.0).astype(np.uint8)
            else:
                normalized = np.zeros_like(patch, dtype=np.uint8)

            img = Image.fromarray(normalized, mode='L')

            # Possible filenames for consistency with context and user prompt
            filenames = [f"{site_id}_heightmap.png"]
            if site_id == 'im1_odysseus':
                filenames.append("im_1_odysseus_heightmap.png")
            elif site_id == 'im_1_odysseus':
                filenames.append("im1_odysseus_heightmap.png")

            for out_dir in output_dirs:
                for fname in filenames:
                    out_path = os.path.join(out_dir, fname)
                    img.save(out_path, format='PNG')

            print(f"Generated {site_id} heightmap: center=({lat}, {lon}), min_elev={min_elev:.1f}m, max_elev={max_elev:.1f}m, span={elev_range:.1f}m")

if __name__ == '__main__':
    generate_heightmaps()
