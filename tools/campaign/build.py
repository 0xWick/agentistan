"""Builds each campaign's map: a closer look at the world map, cut into the campaign's own provinces.

The land is the world map's own (web/world/geo.json, already in the Equal Earth projection), so a campaign's provinces
lie exactly on the parchment tiles. Each province is the Voronoi cell around its city, clipped to the land and to a
reach around the city, so the far edges of the theater stay plain parchment.

The coastline comes from Natural Earth (public domain, ne_10m_land, ne_10m_minor_islands and ne_10m_lakes, zipped,
in the folder NE_DIR names), so islands the world map has no province on (Sardinia, Crete) are land too. Without it,
the land of the world map's provinces is used.

Run (any Python with shapely, numpy and pyshp):
  node tools/campaign/seeds.mjs | NE_DIR=~/geo python tools/campaign/build.py            every campaign
  node tools/campaign/seeds.mjs hannibal | NE_DIR=~/geo python tools/campaign/build.py   one campaign
Writes web/campaign/maps/<id>.json (to draw) and <id>.graph.json (for the engine).
"""
import json, math, os, re, sys
from pathlib import Path

import numpy as np
from shapely import make_valid, voronoi_polygons
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box
from shapely.ops import nearest_points, polylabel, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
GEO = json.loads((ROOT / 'web' / 'world' / 'geo.json').read_text())
WORLD = json.loads((ROOT / 'web' / 'silk' / 'provinces.json').read_text())
OUT = ROOT / 'web' / 'campaign' / 'maps'

# ---------- the projection (the same as tools/map/build.py, from the numbers geo.json carries) ----------
P = GEO['proj']
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def px(lat, lon):
    lam, phi = math.radians(lon - P['lon0']), math.radians(lat)
    th = math.asin(M * math.sin(phi))
    t2 = th * th
    t6 = t2 ** 3
    x = lam * math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return (x - P['x0']) * P['scale'], (P['y1'] - y) * P['scale']


# ---------- the world's land, from its provinces ----------
def rings(d):
    out = []
    for part in re.findall(r'M[^MZ]*Z?', d):
        pts = [tuple(map(float, xy.split())) for xy in re.split(r'[ML]', part.rstrip('Z')) if xy.strip()]
        if len(pts) >= 3:
            out.append(pts)
    return out


def shape_of(d):
    polys = []
    for r in rings(d):
        g = Polygon(r)
        polys.append(g if g.is_valid else make_valid(g))
    # A path's rings are outer shells and holes; an even-odd union of them is close enough at this scale.
    g = polys[0]
    for q in polys[1:]:
        g = g.symmetric_difference(q)
    return g.buffer(0)


world_shapes = [shape_of(p['d']) for p in GEO['provinces']]
WORLD_LAND = unary_union(world_shapes).buffer(0.6).buffer(-0.6)
NE = Path(os.environ.get('NE_DIR', '')).expanduser() if os.environ.get('NE_DIR') else None
_ne = {}


def natural_earth(name, bounds):
    """The shapes of a Natural Earth layer inside (west, south, east, north), in lon/lat."""
    import shapefile
    from shapely.geometry import shape
    if name not in _ne:
        r = shapefile.Reader(str(NE / f'{name}.zip'))
        _ne[name] = [shape(sr.shape.__geo_interface__).buffer(0) for sr in r.iterShapeRecords()]
    frame = box(*bounds)
    return [g.intersection(frame) for g in _ne[name] if g.intersects(frame)]


def land_in(s, w, n, e):
    if not NE:
        return None
    from shapely.ops import transform
    bounds = (w - 2, s - 2, e + 2, n + 2)
    land = unary_union(natural_earth('ne_10m_land', bounds) + natural_earth('ne_10m_minor_islands', bounds))
    lakes = unary_union([g for g in natural_earth('ne_10m_lakes', bounds) if g.area > 0.05])  # only the big lakes
    g = land.difference(lakes).buffer(0)
    out = transform(lambda x, y, z=None: tuple(zip(*[px(b, a) for a, b in zip(x, y)])) if hasattr(x, '__len__') else px(y, x), g)
    return out if out.is_valid else make_valid(out)
TREE = STRtree(world_shapes)
TERRAIN = {p['id']: p['terrain'] for p in WORLD}
WORLD_IDS = [p['id'] for p in GEO['provinces']]


def polygons(g):
    return [g] if g.geom_type == 'Polygon' else [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']


def fmt(c):
    return ' '.join(f'{v:.1f}'.rstrip('0').rstrip('.') for v in c)


def path(g):
    rs = [r for p in polygons(g) for r in [p.exterior, *p.interiors]]
    return ''.join('M' + 'L'.join(fmt(c) for c in list(r.coords)[:-1]) + 'Z' for r in rs)


def lines(g):
    parts = [g] if g.geom_type == 'LineString' else list(getattr(g, 'geoms', []))
    return ''.join('M' + 'L'.join(fmt(c) for c in p.coords) for p in parts if p.geom_type == 'LineString' and len(p.coords) > 1)


def terrain_at(pt):
    hits = [i for i in TREE.query(pt) if world_shapes[i].contains(pt)]
    if not hits:
        i = TREE.nearest(pt)
        hits = [i]
    return TERRAIN.get(WORLD_IDS[hits[0]], 'plains')


def build(c):
    cid = c['id']
    s, w, n, e = c['view']
    corners = [px(s, w), px(s, e), px(n, w), px(n, e), px(n, (w + e) / 2), px(s, (w + e) / 2)]
    xs, ys = [p[0] for p in corners], [p[1] for p in corners]
    frame = box(min(xs), min(ys), max(xs), max(ys))
    land = (land_in(s, w, n, e) or WORLD_LAND).intersection(frame).buffer(0)
    seeds = c['provinces']
    pts = []
    for sd in seeds:
        p = Point(*px(sd['lat'], sd['lon']))
        if not land.buffer(0.5).contains(p):
            q = nearest_points(land, p)[0]
            print(f'  {cid}: {sd["id"]} is {p.distance(q):.0f} units off the land; moved onto the shore', file=sys.stderr)
            p = Point(q.x + (q.x - p.x) * 0.02, q.y + (q.y - p.y) * 0.02) if p.distance(q) > 0 else q
        pts.append(p)
    spread = [min(p.distance(q) for j, q in enumerate(pts) if j != i) for i, p in enumerate(pts)]
    reach = c.get('reach') or 2.4 * float(np.median(spread))
    cells = list(voronoi_polygons(MultiPoint(pts), extend_to=frame.buffer(500)).geoms)
    shapes = []
    for i, (sd, p) in enumerate(zip(seeds, pts)):
        cell = next(g for g in cells if g.buffer(0.01).contains(p))
        g = cell.intersection(land).intersection(p.buffer(sd.get('reach') or reach, 48)).buffer(0)
        # only the land around the city: the piece it stands on, and small islands just off its coast (never a
        # stretch of coast across the sea, which belongs to no one)
        parts = polygons(g)
        if not parts:
            raise SystemExit(f'{cid}: {sd["id"]} has no land')
        main = min(parts, key=lambda q: q.distance(p))
        keep = [main] + [q for q in parts if q is not main and q.distance(main) < 6 and q.area < main.area * 0.5]
        g = unary_union(keep).simplify(0.5, preserve_topology=True).buffer(0)
        if g.is_empty:
            raise SystemExit(f'{cid}: {sd["id"]} has no land')
        shapes.append(g)
    index = {sd['id']: i for i, sd in enumerate(seeds)}
    near = [set() for _ in seeds]
    for i in range(len(seeds)):
        for j in range(i + 1, len(seeds)):
            if shapes[i].buffer(1.2).intersection(shapes[j].buffer(1.2)).area > 6:
                near[i].add(j)
                near[j].add(i)
    for a, b in c.get('cut', []):  # a border with no road across it (a mountain wall, a marsh)
        i, j = index[a], index[b]
        near[i].discard(j)
        near[j].discard(i)
    for a, b in c.get('straits', []):  # a narrow strait: crossed like a river, no fleet needed
        i, j = index[a], index[b]
        near[i].add(j)
        near[j].add(i)
    sea = set()
    for a, b in c.get('sea', []):
        if a not in index or b not in index:
            raise SystemExit(f'{cid}: sea crossing {a}-{b} names an unknown province')
        i, j = index[a], index[b]
        if j not in near[i]:
            sea.add(frozenset((i, j)))
        near[i].add(j)
        near[j].add(i)
    edges = []
    for i in range(len(seeds)):
        for j in near[i]:
            if j > i and frozenset((i, j)) not in sea:
                line = shapes[i].boundary.intersection(shapes[j].buffer(1.4)).simplify(0.5)
                d = lines(line)
                if d:
                    edges.append([seeds[i]['id'], seeds[j]['id'], d])
    out = []
    for i, (sd, p, g) in enumerate(zip(seeds, pts, shapes)):
        main = max(polygons(g), key=lambda q: q.area)
        lab = polylabel(main, tolerance=1)
        out.append({
            'id': sd['id'], 'd': path(g), 'city': [round(p.x, 1), round(p.y, 1)], 'label': [round(lab.x, 1), round(lab.y, 1)],
            'area': round(g.area), 'terrain': sd.get('terrain') or terrain_at(p),
            'neighbors': [seeds[j]['id'] for j in sorted(near[i])],
            'sea': [seeds[j]['id'] for j in sorted(near[i]) if frozenset((i, j)) in sea],
        })
    lonely = [o['id'] for o in out if not o['neighbors']]
    if lonely:
        raise SystemExit(f'{cid}: no way in or out of {lonely}: add a sea crossing')
    # the sea crossings, drawn as dotted lines between the two cities
    lanes = [[seeds[i]['id'], seeds[j]['id']] for i, j in (tuple(sorted(x)) for x in sea)]
    x0, y0, x1, y1 = frame.bounds
    pad = 0.04 * (x1 - x0)
    doc = {
        'id': cid, 'view': [round(x0 - pad, 1), round(y0 - pad, 1), round(x1 - x0 + 2 * pad, 1), round(y1 - y0 + 2 * pad, 1)],
        'coast': path(land.simplify(0.4)), 'provinces': out, 'edges': edges, 'lanes': lanes,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{cid}.json').write_text(json.dumps(doc, separators=(',', ':')))
    # what the engine needs (the browser and the server both import it): the ways between provinces and the ground
    graph = {'provinces': [{k: o[k] for k in ('id', 'terrain', 'neighbors', 'sea', 'area')} for o in out]}
    (OUT / f'{cid}.graph.json').write_text(json.dumps(graph, separators=(',', ':')))
    sizes = sorted(round(g.area) for g in shapes)
    print(f'{cid}: {len(out)} provinces, {len(edges)} borders, {len(lanes)} sea lanes, reach {reach:.0f}, areas {sizes[0]}..{sizes[-1]}, {(OUT / f"{cid}.json").stat().st_size // 1024} KB')


if __name__ == '__main__':
    for c in json.load(sys.stdin):
        build(c)
