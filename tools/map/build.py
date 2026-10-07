"""Builds the Old World map from Natural Earth (public domain): provinces, their borders and crossings, and the
parchment map as tiles.

Run in WSL, in this order:
  /root/.venvs/map/bin/python tools/map/build.py provinces   web/world/geo.json, web/silk/graph.json
  /root/.venvs/map/bin/python tools/map/build.py tiles       web/world/base.webp, web/world/tiles/{level}/{x}_{y}.webp
  /root/.venvs/map/bin/python tools/map/build.py preview [out.png]
Raw data lives in /root/geo (downloaded once, never committed).
"""
import json, math, sys, zipfile
from pathlib import Path

import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageFilter
from shapely.affinity import translate
from shapely.geometry import box, shape
from shapely.ops import unary_union

GEO = Path('/root/geo')
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'web' / 'world'
DATA = ROOT / 'web' / 'silk'

# ---------- the projection: Equal Earth, centred on Central Asia ----------
# Equal-area, so Africa and Siberia keep their true size; the frame holds every meridian from 20°W to 150°E and
# every parallel from 37°S to 72°N.
LON0 = 65.0
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2
WEST, EAST, SOUTH, NORTH = -20.0, 150.0, -37.0, 72.0
WIDTH = 8192  # map units; the sharpest tiles are one pixel per unit


def ee(lon, lat):
    lam, phi = np.radians(np.asarray(lon, dtype=np.float64) - LON0), np.radians(np.asarray(lat, dtype=np.float64))
    th = np.arcsin(M * np.sin(phi))
    t2 = th * th
    t6 = t2 ** 3
    return lam * np.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))


def ee_inv(x, y):
    th = y / A1
    for _ in range(8):
        t2 = th * th
        t6 = t2 ** 3
        f = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y
        fp = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)
        th = th - f / fp
    t2 = th * th
    t6 = t2 ** 3
    fp = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)
    lam = M * x * fp / np.cos(th)
    return np.degrees(lam) + LON0, np.degrees(np.arcsin(np.clip(np.sin(th) / M, -1, 1)))


_lat = np.linspace(SOUTH, NORTH, 400)
_lon = np.linspace(WEST, EAST, 400)
_bx, _by = ee(np.concatenate([np.full(400, WEST), np.full(400, EAST), _lon, _lon]), np.concatenate([_lat, _lat, np.full(400, SOUTH), np.full(400, NORTH)]))
X0, X1, Y0, Y1 = float(_bx.min()), float(_bx.max()), float(_by.min()), float(_by.max())
SCALE = WIDTH / (X1 - X0)
HEIGHT = round((Y1 - Y0) * SCALE)


def px(lon, lat):
    x, y = ee(lon, lat)
    return (x - X0) * SCALE, (Y1 - y) * SCALE


def lonlat(u, v):
    return ee_inv(u / SCALE + X0, Y1 - v / SCALE)


def to_px(g):
    from shapely import make_valid
    from shapely.ops import transform
    out = transform(lambda x, y, z=None: px(x, y), g)
    return out if out.is_valid else make_valid(out)  # projecting can make a coastline cross itself


# ---------- Natural Earth layers ----------
CLIP = box(-75, -55, 180, 86)


def layer(name, clip=CLIP):
    """Shapes of a Natural Earth layer around the Old World, as (record, geometry) pairs. Land just past the date line
    (the far north-east corner of the frame) is copied across it."""
    r = shapefile.Reader(str(next((GEO / name).glob('*.shp'))), encoding='utf-8')
    out = []
    east = box(-180, -90, -140, 90)
    for sr in r.iterShapeRecords():
        g = shape(sr.shape.__geo_interface__)
        if not g.is_valid:
            g = g.buffer(0)
        rec = sr.record.as_dict()
        if g.intersects(clip):
            out.append((rec, g.intersection(clip)))
        if g.intersects(east):
            out.append((rec, translate(g.intersection(east), xoff=360)))
    return out


def polygons(g):
    return [g] if g.geom_type == 'Polygon' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']


def fmt(c, digits=1):
    return ' '.join(f'{v:.{digits}f}'.rstrip('0').rstrip('.') for v in c)


def path(g):
    rings = [r for p in polygons(g) for r in [p.exterior, *p.interiors]]
    return ''.join('M' + 'L'.join(fmt(c) for c in list(r.coords)[:-1]) + 'Z' for r in rings)


def lines(g):
    parts = [g] if g.geom_type == 'LineString' else list(getattr(g, 'geoms', []))
    return ''.join('M' + 'L'.join(fmt(c) for c in p.coords) for p in parts if p.geom_type == 'LineString' and len(p.coords) > 1)


# ---------- provinces ----------
R = 210  # px (about 470 km at the Silk Road's latitude): no province reaches further from its city

# Land nobody fights over in this world. (Lon/lat polygons; everything else far from any city is left wild anyway.)
MASKS = {
    'arabia': [(34.9, 29.45), (35.6, 28.0), (38.5, 23.0), (41.5, 16.0), (43.3, 12.4), (52, 11), (61, 12), (61, 22), (60.5, 22.0), (56.6, 24.8), (56.2, 26.2), (54.6, 25.6),
               (52.5, 26.3), (50.5, 27.9), (48.6, 28.9), (47.7, 29.2), (44.5, 29.1), (41, 31.2), (38.5, 31.5), (37.2, 30.4), (36.2, 29.3)],
    'tibet': [(76.5, 36.6), (91.0, 36.6), (99.0, 34.5), (99.5, 29.0), (97.5, 27.2), (91.0, 26.8), (88.3, 26.9), (86.0, 27.0), (84.0, 27.3), (82.5, 27.8), (81.0, 28.5),
              (80.0, 29.0), (79.0, 30.0), (78.0, 30.8), (77.2, 31.6), (76.0, 32.4), (75.8, 33.2), (75.6, 34.4), (76.0, 35.2)],
    'ncaucasus': [(39.0, 47.6), (39.0, 43.7), (40.6, 43.45), (42.0, 43.25), (43.5, 42.95), (45.0, 42.65), (46.4, 42.25), (47.2, 42.6), (47.6, 43.3), (47.0, 44.5), (46.8, 45.6), (47.2, 47.6)],
    'taklamakan': [(78.2, 38.6), (79.5, 39.6), (81.5, 40.6), (84.0, 41.0), (86.5, 40.8), (88.5, 40.0), (88.8, 38.6), (86.5, 37.9), (84.0, 37.7), (81.5, 37.6), (79.5, 37.9)],
    'deccan': [(72.6, 8.0), (72.6, 21.3), (74.5, 21.7), (76.5, 22.0), (78.5, 22.5), (80.5, 22.9), (82.5, 23.2), (84.5, 23.1), (86.4, 22.5), (87.2, 21.5), (87.2, 8.0)],
    'europe': [(-25, 73), (64, 73), (64, 54), (48, 54), (40, 50.5), (30, 50.0), (24, 49.2), (17.0, 48.9), (16.0, 47.2), (13.5, 46.6), (10.5, 46.5), (7.0, 45.9), (6.6, 44.2),
               (3.5, 43.0), (3.2, 42.4), (0.5, 38.5), (-2.0, 36.6), (-5.6, 35.95), (-6.5, 36.0), (-25, 36.0)],
    'seasia': [(91.0, 22.5), (98.0, 24.0), (101.5, 22.3), (105.5, 22.8), (108.5, 21.5), (110.0, 18.0), (91.0, 5.0)],
    'korea': [(124.2, 40.3), (126.5, 41.5), (128.3, 41.9), (130.7, 42.4), (131.0, 33.0), (124.0, 33.0)],
    'taiwan': [(119.6, 21.6), (122.4, 21.6), (122.4, 25.6), (119.6, 25.6)],
    'sardinia': [(7.9, 38.7), (10.0, 38.7), (10.0, 43.2), (7.9, 43.2)],  # with Corsica: no city here, so no bridge across it
}
# Crossings by sea that armies can make (straits and short passages), with nothing but water between.
SEA = [('constantinople', 'nicaea'), ('palermo', 'naples'), ('acre', 'cyprus'), ('cilicia', 'cyprus'), ('palermo', 'tunis')]


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
    from shapely.geometry import LineString, MultiPoint, Point, Polygon
    from shapely.ops import polylabel

    seeds = json.loads((DATA / 'provinces.json').read_text())
    frame = box(0, 0, WIDTH, HEIGHT)
    land_all = to_px(unary_union([g for _, g in layer('ne_10m_land')])).intersection(frame).buffer(0)
    water = to_px(unary_union([g for n in ('ne_10m_lakes', 'ne_10m_lakes_historic') for _, g in layer(n)]))
    off = to_px(unary_union([Polygon(m) for m in MASKS.values()]))
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
        elif u.area < 6000:
            best = max(range(len(seeds)), key=lambda i: u.intersection(cell_of[i]).area)
            if u.intersection(cell_of[best]).area > 0:
                pieces[best].append(u)
        else:
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

    # What lies on the road between two neighbours' cities: big rivers to ford, mountain ranges to climb.
    rivers = [(rec, to_px(g)) for rec, g in layer('ne_10m_rivers_lake_centerlines') if (rec.get('scalerank') or 99) <= 7]
    big = {}
    for rec, g in rivers:
        if (rec.get('scalerank') or 99) <= 5:
            big.setdefault(rec.get('name') or str(id(g)), []).append(g)
    big_rivers = [unary_union(gs) for gs in big.values()]
    ranges = unary_union([to_px(g) for rec, g in layer('ne_10m_geography_regions_polys') if rec['FEATURECLA'] == 'Range/mtn' and (rec.get('SCALERANK') or 9) <= 5])

    index = {s['id']: i for i, s in enumerate(seeds)}
    city = [[round(v, 1) for v in px(s['lon'], s['lat'])] for s in seeds]
    graph, out, edges = {}, [], []
    near = [[] for _ in seeds]
    for i in range(len(seeds)):
        for j in range(i + 1, len(seeds)):
            if shapes[i].envelope.buffer(3).intersects(shapes[j].envelope) and shapes[i].buffer(1.5).intersection(shapes[j].buffer(1.5)).area > 12:
                near[i].append(j)
                near[j].append(i)
    for a, b in SEA:
        i, j = index[a], index[b]
        if j not in near[i]:
            near[i].append(j)
            near[j].append(i)
    sea = {frozenset((index[a], index[b])) for a, b in SEA}
    ways = [dict() for _ in seeds]
    for i in range(len(seeds)):
        for j in near[i]:
            if j < i:
                continue
            road = LineString([city[i], city[j]])
            # A river counts when the cities stand on opposite banks: an odd number of crossings. A road beside a
            # winding river crosses it an even number of times and stays on one bank.
            crossings = 0
            for rv in big_rivers:
                hit = road.intersection(rv)
                if not hit.is_empty and len(getattr(hit, 'geoms', [hit])) % 2:
                    crossings += 1
            climb = road.intersection(ranges).length if not ranges.is_empty else 0
            w = {'river': min(2, crossings), 'pass': climb > 25, 'sea': frozenset((i, j)) in sea}
            ways[i][seeds[j]['id']] = ways[j][seeds[i]['id']] = w
            line = shapes[i].boundary.intersection(shapes[j].buffer(1.6)).simplify(0.6)
            d = lines(line)
            if d:
                edges.append([i, j, d])
    for i, s in enumerate(seeds):
        g = shapes[i]
        main = max(polygons(g), key=lambda q: q.area)
        lab = polylabel(main, tolerance=2)
        graph[s['id']] = {'neighbors': [seeds[j]['id'] for j in near[i]], 'ways': ways[i], 'city': city[i], 'label': [round(lab.x, 1), round(lab.y, 1)], 'area': round(g.area)}
        out.append({'id': s['id'], 'd': path(g), 'label': graph[s['id']]['label'], 'city': city[i]})

    river_out = []
    for rec, g in rivers:
        d = lines(g.intersection(frame).simplify(1.0))
        if d:
            river_out.append({'d': d, 'rank': rec['scalerank'], 'name': rec.get('name') or ''})

    proj = {'name': 'equal-earth', 'lon0': LON0, 'x0': X0, 'y1': Y1, 'scale': SCALE}
    (OUT / 'geo.json').write_text(json.dumps({'width': WIDTH, 'height': HEIGHT, 'proj': proj, 'provinces': out, 'edges': edges, 'rivers': river_out}, separators=(',', ':')))
    (DATA / 'graph.json').write_text(json.dumps(graph, indent=1))
    # The playable land, for fading the rest of the world on the tiles.
    unary_union(shapes).simplify(1.5).buffer(0)
    (GEO / 'playable.json').write_text(json.dumps([path(g) for g in shapes]))
    lonely = [k for k, v in graph.items() if not v['neighbors']]
    passes = sum(w['pass'] for w in ways for w in w.values()) // 2
    fords = sum(w['river'] > 0 for w in ways for w in w.values()) // 2
    print(f'{WIDTH}x{HEIGHT} provinces {len(out)} rivers {len(river_out)} passes {passes} fords {fords} geo.json {(OUT / "geo.json").stat().st_size // 1024} KB, no neighbours: {lonely}')


# ---------- the parchment map, as tiles ----------
TILE = 512
LEVELS = 4  # level 3 is one pixel per map unit; each level below halves it


def rasterize_polys(polys, size, scale, fill=255):
    """A mask image of the given polygons (map units), drawn at size (w, h) after scaling by `scale`."""
    img = Image.new('L', size, 0)
    d = ImageDraw.Draw(img)
    for g in polys:
        for p in polygons(g):
            d.polygon([(x * scale, y * scale) for x, y in p.exterior.coords], fill=fill)
            for hole in p.interiors:
                d.polygon([(x * scale, y * scale) for x, y in hole.coords], fill=0)
    return img


def svg_rings(dd):
    import re
    for ring in re.findall(r'M([^Z]+)Z', dd):
        nums = [float(v) for v in re.split(r'[ L]', ring) if v]
        yield list(zip(nums[0::2], nums[1::2]))


def tiles():
    from scipy import ndimage
    rng = np.random.default_rng(1200)
    tif = GEO / 'relief' / 'NE1_HR_LC_SR_W.tif'
    if not tif.exists():
        with zipfile.ZipFile(GEO / 'relief.zip') as z:
            z.extractall(GEO / 'relief')
    Image.MAX_IMAGE_PIXELS = None
    src_img = Image.open(tif)
    ppd = src_img.width / 360
    top = max(0, int((90 - 75) * ppd))
    bottom = min(src_img.height, int((90 + 40) * ppd))
    src = np.asarray(src_img.crop((0, top, src_img.width, bottom)).convert('RGB'))
    chan = [np.ascontiguousarray(src[..., c]) for c in range(3)]
    del src

    # Water, at full size, from the sea, the lakes and the Aral Sea before the 20th century drained it.
    print('water mask…')
    waters = [to_px(g) for n in ('ne_10m_ocean', 'ne_10m_lakes', 'ne_10m_lakes_historic') for _, g in layer(n)]
    water = rasterize_polys(waters, (WIDTH, HEIGHT), 1)
    # Engraved shore lines and ripples, worked out at half size and enlarged.
    half = water.resize((WIDTH // 2, HEIGHT // 2), Image.BILINEAR)
    wet = np.asarray(half) > 127
    dist = ndimage.distance_transform_edt(wet).astype(np.float32)
    rip = np.zeros_like(dist)
    for d0, k in ((3.5, 0.9), (8, 0.5), (14, 0.32), (22, 0.18)):
        rip = np.maximum(rip, k * np.clip(1 - np.abs(dist - d0) / 0.9, 0, 1))
    rip[~wet] = 0
    ripple = Image.fromarray((rip * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BILINEAR)
    del dist, rip, wet
    # Lands outside the playable world are left pale, like the unexplored edges of an old map.
    print('playable land…')
    play = Image.new('L', (WIDTH // 2, HEIGHT // 2), 0)
    d = ImageDraw.Draw(play)
    for dd in json.loads((GEO / 'playable.json').read_text()):
        for ring in svg_rings(dd):
            d.polygon([(x / 2, y / 2) for x, y in ring], fill=255)
    play = play.filter(ImageFilter.GaussianBlur(6)).resize((WIDTH, HEIGHT), Image.BILINEAR)
    blot = Image.fromarray((rng.random((HEIGHT // 40 + 2, WIDTH // 40 + 2)) * 255).astype(np.uint8)).resize((WIDTH // 8, HEIGHT // 8), Image.BICUBIC).filter(ImageFilter.GaussianBlur(4))
    blot = np.asarray(blot.resize((WIDTH, HEIGHT), Image.BILINEAR))

    parchment = np.array([0.9, 0.82, 0.655], dtype=np.float32)
    sea_tone = np.array([0.70, 0.76, 0.70], dtype=np.float32)
    full = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for y0 in range(0, HEIGHT, TILE):
        y1 = min(HEIGHT, y0 + TILE)
        v, u = np.mgrid[y0:y1, 0:WIDTH].astype(np.float64)
        lon, lat = lonlat(u + 0.5, v + 0.5)
        lon = (lon + 180) % 360 - 180
        cols, rows = (lon + 180) * ppd - 0.5, (90 - lat) * ppd - 0.5 - top
        img = np.stack([ndimage.map_coordinates(c, [rows, cols], order=1, mode='nearest') for c in chan], axis=-1).astype(np.float32) / 255
        lum = img @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
        shade = (0.46 + 0.66 * np.clip(lum, 0, 1) ** 1.3)[..., None]
        land = np.clip(parchment * shade, 0, 1) * 0.86 + img * 0.14
        wmask = np.asarray(water.crop((0, y0, WIDTH, y1))).astype(np.float32)[..., None] / 255
        out = land * (1 - wmask) + sea_tone * wmask
        # unexplored lands fade towards bare parchment
        pl = np.asarray(play.crop((0, y0, WIDTH, y1))).astype(np.float32)[..., None] / 255
        out = out * (0.55 + 0.45 * pl + (1 - pl) * 0.0) + parchment * (1 - pl) * 0.45 * (1 - wmask)
        # ink: the shore and its ripples
        rp = np.asarray(ripple.crop((0, y0, WIDTH, y1))).astype(np.float32)[..., None] / 255
        out = out * (1 - 0.38 * rp)
        # paper: stains, grain, and edges darkened by age
        bl = blot[y0:y1].astype(np.float32)[..., None] / 255
        out = out * (0.9 + 0.14 * bl) + rng.normal(0, 0.016, (y1 - y0, WIDTH, 1)).astype(np.float32)
        edge = np.clip(np.minimum.reduce([u, v, WIDTH - u, HEIGHT - v]) / 260, 0, 1).astype(np.float32)[..., None]
        out = out * (0.7 + 0.3 * edge ** 0.6) * np.array([1, 0.97, 0.9], dtype=np.float32) ** (1 - edge)
        full[y0:y1] = (np.clip(out, 0, 1) * 255).astype(np.uint8)
        print(f'  rows {y0}-{y1}')
    del chan

    base = Image.fromarray(full)
    for level in range(LEVELS):
        w = WIDTH >> (LEVELS - 1 - level)
        h = math.ceil(HEIGHT * w / WIDTH)
        img = base if w == WIDTH else base.resize((w, h), Image.LANCZOS)
        folder = OUT / 'tiles' / str(level)
        folder.mkdir(parents=True, exist_ok=True)
        for ty in range(math.ceil(h / TILE)):
            for tx in range(math.ceil(w / TILE)):
                img.crop((tx * TILE, ty * TILE, min(w, (tx + 1) * TILE), min(h, (ty + 1) * TILE))).save(folder / f'{tx}_{ty}.webp', quality=78, method=5)
        if level == 0:
            img.save(OUT / 'base.webp', quality=80, method=6)
        print(f'level {level}: {w}x{h}')
    meta = {'width': WIDTH, 'height': HEIGHT, 'tile': TILE, 'levels': LEVELS}
    (OUT / 'tiles' / 'meta.json').write_text(json.dumps(meta))
    total = sum(f.stat().st_size for f in (OUT / 'tiles').rglob('*.webp'))
    print('tiles', total // 1024 // 1024, 'MB in all; base', (OUT / 'base.webp').stat().st_size // 1024, 'KB')


def preview(to='/tmp/provinces.png'):
    """The provinces in their realms' colours over the map, for a look before anything is wired up."""
    seeds = json.loads((DATA / 'provinces.json').read_text())
    realms = {r['id']: r for r in json.loads((DATA / 'realms.json').read_text())}
    geo = json.loads((OUT / 'geo.json').read_text())
    img = Image.open(OUT / 'tiles' / '2' / '0_0.webp') if False else None
    k = 0.25
    canvas = Image.open(OUT / 'base.webp').convert('RGBA').resize((round(WIDTH * k), round(HEIGHT * k))) if (OUT / 'base.webp').exists() else Image.new('RGBA', (round(WIDTH * k), round(HEIGHT * k)), (225, 210, 170, 255))
    fill = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(fill)
    for s, p in zip(seeds, geo['provinces']):
        r = realms.get(s['owner'])
        rgb = tuple(int(r['color'][i:i + 2], 16) for i in (1, 3, 5)) if r else (120, 110, 95)
        for ring in svg_rings(p['d']):
            d.polygon([(x * k, y * k) for x, y in ring], fill=rgb + ((120 if r else 40),), outline=(30, 22, 12, 200))
        x, y = p['city']
        d.ellipse([x * k - 2, y * k - 2, x * k + 2, y * k + 2], fill=(25, 18, 10, 255))
    Image.alpha_composite(canvas, fill).convert('RGB').save(to)
    print('preview', to)


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else 'provinces'
    if step == 'preview':
        preview(*sys.argv[2:])
    else:
        {'provinces': provinces, 'tiles': tiles}[step]()
