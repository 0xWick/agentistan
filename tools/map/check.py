"""Prints the borders the history of the Silk Road needs, so a map rebuild can't quietly cut a famous road."""
import json
from pathlib import Path

g = json.loads((Path(__file__).resolve().parents[2] / 'web' / 'silk' / 'graph.json').read_text())
ROADS = [('bukhara', 'samarkand'), ('merv', 'bukhara'), ('balkh', 'termez'), ('herat', 'merv'), ('kabul', 'peshawar'), ('lahore', 'delhi'),
         ('multan', 'sehwan'), ('rey', 'kumis'), ('kashgar', 'ferghana'), ('khiva', 'bukhara'), ('kartli', 'arran'), ('qazvin', 'alamut'),
         ('sarakhs', 'merv'), ('nishapur', 'sarakhs'), ('ghazni', 'kabul'), ('herat', 'ghor'), ('delhi', 'kannauj'), ('lahore', 'saltrange')]
missing = [f'{a}-{b}' for a, b in ROADS if b not in g[a]['neighbors']]
asym = [f'{a}-{b}' for a, v in g.items() for b in v['neighbors'] if a not in g[b]['neighbors']]
print('missing roads:', missing or 'none', '| one-way borders:', asym or 'none', '| lonely:', [k for k, v in g.items() if not v['neighbors']] or 'none')
