# Crops the raw paintings from tools/art.mjs into web/art/ and writes the manifest the page reads.
#   /root/.venvs/map/bin/python tools/art.py
# Events: a wide band (768x340) for the top of the great-event card. People: a 192x192 roundel crop.
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, ART = os.path.join(ROOT, 'tools', 'art-raw'), os.path.join(ROOT, 'web', 'art')
os.makedirs(os.path.join(ART, 'events'), exist_ok=True)
os.makedirs(os.path.join(ART, 'people'), exist_ok=True)
man = {'events': [], 'people': []}
for f in sorted(os.listdir(RAW)):
    if not f.endswith('.jpg'):
        continue
    kind, key = f[:-4].split('-', 1)
    im = Image.open(os.path.join(RAW, f)).convert('RGB')
    w, h = im.size
    if kind == 'event':
        band = int(w * 340 / 768)
        top = max(0, int(h * 0.42) - band // 2)
        im.crop((0, top, w, top + band)).resize((768, 340), Image.LANCZOS).save(os.path.join(ART, 'events', f'{key}.webp'), 'WEBP', quality=78)
        man['events'].append(key)
    else:
        side = int(min(w, h) * 0.72)
        left, top = (w - side) // 2, int(h * 0.06)
        im.crop((left, top, left + side, top + side)).resize((192, 192), Image.LANCZOS).save(os.path.join(ART, 'people', f'{key}.webp'), 'WEBP', quality=80)
        man['people'].append(key)
json.dump(man, open(os.path.join(ART, 'manifest.json'), 'w'))
print(len(man['events']), 'events,', len(man['people']), 'people')
