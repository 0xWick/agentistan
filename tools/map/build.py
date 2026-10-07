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


def paper():
    """The relief as an old engraved map on parchment: sepia hill shading, pale aged seas, stains and a burnt edge."""
    rng = np.random.default_rng(1200)
    src = np.asarray(relief()).astype(np.float32) / 255
    lum = src @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    parchment = np.array([0.9, 0.82, 0.655], dtype=np.float32)
    shade = (0.46 + 0.66 * np.clip(lum, 0, 1) ** 1.3)[..., None]
    land = np.clip(parchment * shade, 0, 1) * 0.86 + src * 0.14  # a hint of the real land cover, like a hand-tinted print

    water = Image.new('L', (WIDTH, HEIGHT), 0)
    d = ImageDraw.Draw(water)
    for name in ('ne_10m_ocean', 'ne_10m_lakes', 'ne_10m_lakes_historic'):
        for _, g in layer(name):
            paint(d, g, 255)
    soft = np.asarray(water.filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32)[..., None] / 255
    near = np.asarray(water.filter(ImageFilter.GaussianBlur(18))).astype(np.float32)[..., None] / 255
    sea = np.array([0.70, 0.76, 0.70], dtype=np.float32) * (0.92 + 0.08 * near)  # aged sea-green, a little deeper offshore
    out = land * (1 - soft) + sea * soft

    # Paper: blotchy stains, a fine grain, and edges darkened as if by age and candle smoke.
    blot = Image.fromarray((rng.random((HEIGHT // 16, WIDTH // 16)) * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BICUBIC).filter(ImageFilter.GaussianBlur(24))
    blot = np.asarray(blot).astype(np.float32)[..., None] / 255
    grain = rng.normal(0, 0.018, (HEIGHT, WIDTH, 1)).astype(np.float32)
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
    edge = np.clip(np.minimum.reduce([xx, yy, WIDTH - xx, HEIGHT - yy]) / 140, 0, 1)[..., None]
    out = out * (0.9 + 0.14 * blot) + grain
    out = out * (0.72 + 0.28 * edge ** 0.6) * np.array([1, 0.97, 0.9], dtype=np.float32) ** (1 - edge)

    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT / 'paper.webp', quality=80, method=6)
    print('paper.webp', (OUT / 'paper.webp').stat().st_size // 1024, 'KB')


DATA = Path(__file__).resolve().parents[2] / 'web' / 'silk'
R = 230  # px (about 425 km): no province reaches further than this from its city

# Land nobody fights over in this world: Arabia (south of the Gulf) and the Tibetan plateau with the high Himalaya.
ARABIA = [(39.0, 18.0), (39.0, 30.6), (44.5, 29.1), (47.7, 29.2), (48.6, 28.9), (50.5, 27.9), (52.5, 26.3), (54.6, 25.6), (56.2, 26.2), (56.6, 24.8), (60.5, 22.0), (61.0, 18.0)]
# North of the Caucasus ridge, the sand sea of the Taklamakan, and the Deccan south of the Narmada are wild land too.
NCAUCASUS = [(39.0, 47.6), (39.0, 43.7), (40.6, 43.45), (42.0, 43.25), (43.5, 42.95), (45.0, 42.65), (46.4, 42.25), (47.2, 42.6), (47.6, 43.3), (47.0, 44.5), (46.8, 45.6), (47.2, 47.6)]
TAKLAMAKAN = [(78.2, 38.6), (79.5, 39.6), (81.5, 40.6), (84.0, 41.0), (86.5, 40.8), (88.5, 40.0), (88.8, 38.6), (86.5, 37.9), (84.0, 37.7), (81.5, 37.6), (79.5, 37.9)]
DECCAN = [(72.6, 18.0), (72.6, 21.3), (74.5, 21.7), (76.5, 22.0), (78.5, 22.5), (80.5, 22.9), (82.5, 23.2), (84.5, 23.1), (86.4, 22.5), (87.2, 21.5), (87.2, 18.0)]
TIBET = [(76.5, 36.6), (91.0, 36.6), (91.0, 26.8), (88.3, 26.9), (86.0, 27.0), (84.0, 27.3), (82.5, 27.8), (81.0, 28.5), (80.0, 29.0), (79.0, 30.0), (78.0, 30.8),
         (77.2, 31.6), (76.0, 32.4), (75.8, 33.2), (75.6, 34.4), (76.0, 35.2)]


def to_px(g):
    from shapely.ops import transform
    return transform(lambda x, y, z=None: px(x, y), g)


def path(g, digits=1):
    """SVG path data for a polygon or multipolygon, in map pixels."""
    f = lambda c: ' '.join(f'{v:.{digits}f}'.rstrip('0').rstrip('.') for v in c)
    rings = [r for p in polygons(g) for r in [p.exterior, *p.interiors]]
    return ''.join('M' + 'L'.join(f(c) for c in list(r.coords)[:-1]) + 'Z' for r in rings)


def lines(g, digits=1):
    f = lambda c: ' '.join(f'{v:.{digits}f}'.rstrip('0').rstrip('.') for v in c)
    parts = [g] if g.geom_type == 'LineString' else list(getattr(g, 'geoms', []))
    return ''.join('M' + 'L'.join(f(c) for c in p.coords) for p in parts if p.geom_type == 'LineString' and len(p.coords) > 1)


def frontier(p, key):
    """How far a province reaches from its city: an irregular, natural-looking edge rather than a circle."""
    import hashlib
    from shapely.geometry import Polygon
    h = hashlib.sha256(key.encode()).digest()
    ph = [h[k] / 255 * 2 * math.pi for k in range(3)]
    ring = []
    for k in range(120):
        t = 2 * math.pi * k / 120
        r = R * (1 + 0.13 * math.sin(3 * t + ph[0]) + 0.08 * math.sin(5 * t + ph[1]) + 0.05 * math.sin(11 * t + ph[2]))
        ring.append((p.x + r * math.cos(t), p.y + r * math.sin(t)))
    return Polygon(ring)


def provinces():
    from shapely import voronoi_polygons
    from shapely.geometry import MultiPoint, Point, Polygon
    from shapely.ops import polylabel

    seeds = json.loads((DATA / 'provinces.json').read_text())
    frame = box(0, 0, WIDTH, HEIGHT)
    land_all = to_px(unary_union([g for _, g in layer('ne_10m_land')])).intersection(frame)
    water = to_px(unary_union([g for n in ('ne_10m_lakes', 'ne_10m_lakes_historic') for _, g in layer(n)]))
    off = to_px(unary_union([Polygon(m) for m in (ARABIA, TIBET, NCAUCASUS, TAKLAMAKAN, DECCAN)]))
    land = land_all.difference(water).difference(off).buffer(0)

    pts = [Point(*px(s['lon'], s['lat'])) for s in seeds]
    cells = list(voronoi_polygons(MultiPoint(pts), extend_to=frame).geoms)
    cell_of = [next(c for c in cells if c.contains(p)) for p in pts]

    # Real administrative borders follow rivers and ridges, so provinces are built from them. A unit holding several
    # cities is split between them; a small unit holding none goes whole to the city whose plain territory covers most
    # of it, and a big one is shared out.
    pieces = [[] for _ in seeds]
    for _, g in layer('ne_10m_admin_1_states_provinces'):
        u = to_px(g).intersection(land)
        if u.is_empty or u.area < 1:
            continue
        inside = [i for i, p in enumerate(pts) if u.buffer(0.5).contains(p)]
        if len(inside) == 1:
            pieces[inside[0]].append(u)
        elif inside:
            local = list(voronoi_polygons(MultiPoint([pts[i] for i in inside]), extend_to=frame).geoms)
            for i in inside:
                c = next(c for c in local if c.contains(pts[i]))
                pieces[i].append(u.intersection(c))
        elif u.area < 6000:  # a small unit stays whole, so its real border is kept
            best = max(range(len(seeds)), key=lambda i: u.intersection(cell_of[i]).area)
            if u.intersection(cell_of[best]).area > 0:
                pieces[best].append(u)
        else:  # a big empty unit (a desert, a steppe oblast) is shared, so neighbouring cities still touch
            for i in range(len(seeds)):
                piece = u.intersection(cell_of[i])
                if piece.area > 1:
                    pieces[i].append(piece)

    shapes = []
    for i, (s, p) in enumerate(zip(seeds, pts)):
        g = unary_union(pieces[i]).intersection(frontier(p, s['id'])).buffer(0)
        keep = [q for q in polygons(g) if q.area > 60 or q.buffer(2).contains(p)]
        g = unary_union(keep).simplify(0.9, preserve_topology=True)
        if g.is_empty:
            raise SystemExit(f'{s["id"]} has no land: check its coordinates')
        shapes.append(g)

    graph, out = {}, []
    for i, s in enumerate(seeds):
        g, near = shapes[i], []
        for j, h in enumerate(shapes):
            if i != j and g.envelope.buffer(3).intersects(h.envelope) and g.buffer(1.5).intersection(h.buffer(1.5)).area > 12:
                near.append(seeds[j]['id'])
        main = max(polygons(g), key=lambda q: q.area)
        lab = polylabel(main, tolerance=2)
        city = [round(v, 1) for v in px(s['lon'], s['lat'])]
        graph[s['id']] = {'neighbors': near, 'city': city, 'label': [round(lab.x, 1), round(lab.y, 1)], 'area': round(g.area)}
        out.append({'id': s['id'], 'd': path(g), 'label': graph[s['id']]['label'], 'city': city})

    rivers = []
    for rec, g in layer('ne_10m_rivers_lake_centerlines'):
        if (rec.get('scalerank') or 99) <= 7:
            d = lines(to_px(g).intersection(frame).simplify(0.8))
            if d:
                rivers.append({'d': d, 'rank': rec['scalerank'], 'name': rec.get('name') or ''})
    coast = path(land_all.simplify(0.8, preserve_topology=True))

    # The border between each pair of neighbours, so the page can ink realm borders boldly and keep a province's
    # inner borders faint.
    index = {s['id']: i for i, s in enumerate(seeds)}
    edges = []
    for i, s in enumerate(seeds):
        for n in graph[s['id']]['neighbors']:
            j = index[n]
            if j < i:
                continue
            line = shapes[i].boundary.intersection(shapes[j].buffer(1.6)).simplify(0.6)
            d = lines(line)
            if d:
                edges.append([i, j, d])

    (OUT / 'geo.json').write_text(json.dumps({'width': WIDTH, 'height': HEIGHT, 'provinces': out, 'edges': edges, 'rivers': rivers, 'coast': coast}, separators=(',', ':')))
    (DATA / 'graph.json').write_text(json.dumps(graph, indent=1))
    lonely = [k for k, v in graph.items() if not v['neighbors']]
    print('provinces', len(out), 'rivers', len(rivers), 'geo.json', (OUT / 'geo.json').stat().st_size // 1024, 'KB', 'no neighbours:', lonely)
    return seeds, shapes


def preview(to='/tmp/provinces.png'):
    """The provinces in their realms' colours over the relief, for a look before anything is wired up."""
    seeds = json.loads((DATA / 'provinces.json').read_text())
    realms = {r['id']: r for r in json.loads((DATA / 'realms.json').read_text())}
    geo = json.loads((OUT / 'geo.json').read_text())
    img = Image.open(OUT / 'relief.webp').convert('RGBA')
    fill = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(fill)
    import re
    def rings(dd):
        for ring in re.findall(r'M([^Z]+)Z', dd):
            nums = [float(v) for v in re.split(r'[ L]', ring) if v]
            yield list(zip(nums[0::2], nums[1::2]))
    for s, p in zip(seeds, geo['provinces']):
        r = realms.get(s['owner'])
        rgb = tuple(int(r['color'][k:k + 2], 16) for k in (1, 3, 5)) if r else (120, 110, 95)
        for ring in rings(p['d']):
            d.polygon(ring, fill=rgb + ((115 if r else 40),), outline=(30, 22, 12, 200))
        x, y = p['city']
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(25, 18, 10, 255))
        d.text((x + 6, y - 6), s['name'], fill=(20, 14, 8, 255))
    Image.alpha_composite(img, fill).convert('RGB').save(to)
    print('preview', to)


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else 'base'
    if step == 'preview':
        preview(*sys.argv[2:])
    else:
        {'base': base, 'provinces': provinces, 'paper': paper}[step]()
