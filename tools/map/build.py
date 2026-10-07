"""Builds the Silk Road map from Natural Earth (public domain): the painted relief and, later, the provinces.

Run in WSL:  /root/.venvs/map/bin/python tools/map/build.py base
Raw data lives in /root/geo (downloaded once, never committed). Outputs go to web/world/.
"""
import json, math, sys, zipfile
from pathlib import Path

import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import box, shape
from shapely.ops import unary_union

GEO = Path('/root/geo')
OUT = Path(__file__).resolve().parents[2] / 'web' / 'world'

# The world of 1200 AD: Baghdad and Georgia to Bengal, the Aral steppe to Gujarat. Plate carree with a standard
# parallel, so a degree of longitude is as wide on the map as it is on the ground at the middle latitude.
WEST, EAST, SOUTH, NORTH = 39.5, 90.5, 18.5, 47.5
LAT0 = 33.0
WIDTH = 2560
HEIGHT = round(WIDTH * (NORTH - SOUTH) / ((EAST - WEST) * math.cos(math.radians(LAT0))))


def px(lon, lat):
    return ((lon - WEST) / (EAST - WEST) * WIDTH, (NORTH - lat) / (NORTH - SOUTH) * HEIGHT)


def layer(name, bbox=box(WEST - 1, SOUTH - 1, EAST + 1, NORTH + 1)):
    """Shapes of a Natural Earth layer, clipped to the map, as (record, geometry) pairs."""
    r = shapefile.Reader(str(next((GEO / name).glob('*.shp'))), encoding="utf-8")
    out = []
    for sr in r.iterShapeRecords():
        g = shape(sr.shape.__geo_interface__)
        if not g.is_valid:
            g = g.buffer(0)
        if g.intersects(bbox):
            out.append((sr.record.as_dict(), g.intersection(bbox)))
    return out


def polygons(g):
    return [g] if g.geom_type == 'Polygon' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']


def paint(draw, g, fill):
    for p in polygons(g):
        draw.polygon([px(*c) for c in p.exterior.coords], fill=fill)
        for hole in p.interiors:
            draw.polygon([px(*c) for c in hole.coords], fill=0)


def relief():
    """The source relief (Natural Earth I, 60 px per degree), cropped to the map and squeezed to the projection."""
    tif = GEO / 'relief' / 'NE1_HR_LC_SR_W.tif'
    if not tif.exists():
        with zipfile.ZipFile(GEO / 'relief.zip') as z:
            z.extractall(GEO / 'relief')
    Image.MAX_IMAGE_PIXELS = None
    src = Image.open(tif)
    ppd = src.width / 360
    crop = src.crop((round((WEST + 180) * ppd), round((90 - NORTH) * ppd), round((EAST + 180) * ppd), round((90 - SOUTH) * ppd)))
    return crop.convert('RGB').resize((WIDTH, HEIGHT), Image.LANCZOS)


def base():
    img = np.asarray(relief()).astype(np.float32) / 255

    # The look of a war-history video: earthy, warm land with deep relief shadows; deep, calm water.
    grey = img @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    land = grey[..., None] + (img - grey[..., None]) * 0.75  # keep most of the colour
    land = np.clip(np.clip((land - 0.5) * 1.25 + 0.5, 0, 1) * np.array([0.92, 0.87, 0.77], dtype=np.float32), 0, 1) ** 1.5

    # Water: the sea, the lakes, and the Aral Sea as it was before the 20th century drained it.
    water = Image.new('L', (WIDTH, HEIGHT), 0)
    d = ImageDraw.Draw(water)
    for name in ('ne_10m_ocean', 'ne_10m_lakes', 'ne_10m_lakes_historic'):
        for _, g in layer(name):
            paint(d, g, 255)
    soft = np.asarray(water.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255
    # Shallows near the shore are a touch lighter, open water darker.
    depth = np.asarray(water.filter(ImageFilter.GaussianBlur(28))).astype(np.float32)[..., None] / 255
    sea = np.array([0.20, 0.33, 0.39], dtype=np.float32) * (1 - 0.35 * depth) + np.array([0.04, 0.05, 0.05], dtype=np.float32) * grey[..., None]
    out = land * (1 - soft) + sea * soft

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT / 'relief.webp', quality=82, method=6)
    (OUT / 'projection.json').write_text(json.dumps({'west': WEST, 'east': EAST, 'south': SOUTH, 'north': NORTH, 'width': WIDTH, 'height': HEIGHT}))
    print('relief.webp', WIDTH, HEIGHT, (OUT / 'relief.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    {'base': base}[sys.argv[1] if len(sys.argv) > 1 else 'base']()
