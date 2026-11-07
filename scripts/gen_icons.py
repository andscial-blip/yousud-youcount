#!/usr/bin/env python3
"""Marchio YouCount (proposta 2, «Ricevuta a mosaico», scelta da Andrea il 7/11/2026).
Un giustificativo composto di tessere nei colori del logo YouSud, con la spunta bianca della verifica.
Tutto vettoriale: genera public/brand/youcount-mark.svg, le icone PWA e la favicon.
Richiede shapely, rsvg-convert e ImageMagick (convert)."""
import math, pathlib, subprocess
from shapely.geometry import Polygon

root = pathlib.Path(__file__).resolve().parent.parent
brand, icons = root / 'public/brand', root / 'public/icons'
brand.mkdir(parents=True, exist_ok=True)
icons.mkdir(exist_ok=True)

# sagoma: rettangolo con angoli superiori arrotondati e quattro denti in basso (scontrino strappato)
X0, X1, Y0, Y1, R, TEETH, DEPTH = 22, 78, 8, 86, 7, 4, 7
outline = []
for a in range(180, 271, 10):
    outline.append((X0 + R + R * math.cos(math.radians(a)), Y0 + R + R * math.sin(math.radians(a))))
for a in range(270, 361, 10):
    outline.append((X1 - R + R * math.cos(math.radians(a)), Y0 + R + R * math.sin(math.radians(a))))
w = (X1 - X0) / TEETH
outline.append((X1, Y1))
for i in range(TEETH):
    outline += [(X1 - i * w - w / 2, Y1 + DEPTH), (X1 - (i + 1) * w, Y1)]
SHAPE = Polygon(outline)

# tessere disegnate a mano (si ritagliano sulla sagoma); colori del logo YouSud, mai uguali tra vicine
P = dict(T0=(10, -2), T1=(40, -2), T2=(58, -2), T3=(90, -2), L1=(10, 32), a=(36, 28), b=(52, 22), c=(66, 34),
         R1=(90, 24), L2=(10, 56), d=(34, 50), e=(50, 45), f=(63, 58), R2=(90, 52), L3=(10, 78), g=(38, 70),
         h=(54, 75), i=(68, 67), R3=(90, 77), B0=(10, 100), B1=(40, 100), B2=(58, 100), B3=(90, 100))
FACETS = [
    ('T0 T1 a L1', '#00A060'), ('T1 T2 b a', '#186838'), ('T2 T3 R1 c b', '#F0B048'),
    ('L1 a d L2', '#C02828'), ('a b e d', '#90B848'), ('b c e', '#603088'), ('c R1 R2 f', '#C81858'),
    ('e c f', '#0870B0'), ('L2 d g L3', '#30A8D8'), ('d e h g', '#D8D038'), ('e f i h', '#E85828'),
    ('f R2 R3 i', '#00A060'), ('L3 g B1 B0', '#F0B048'), ('g h B2 B1', '#0870B0'), ('h i R3 B3 B2', '#C02828'),
]


def path(poly):
    return 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in poly.exterior.coords[:-1]) + 'Z'


def mark_body(seam='#FFFFFF'):
    out = []
    for names, col in FACETS:
        piece = Polygon([P[n] for n in names.split()]).intersection(SHAPE)
        if not piece.is_empty and piece.area > 0.5:
            out.append(f'<path d="{path(piece)}" fill="{col}" stroke="{seam}" stroke-width="1.3" stroke-linejoin="round"/>')
    out.append('<path d="M35.5 50 L46.5 61 L66.5 39" transform="translate(0.9 1.4)" fill="none" stroke="#16324F" '
               'stroke-opacity="0.22" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append('<path d="M35.5 50 L46.5 61 L66.5 39" fill="none" stroke="#FFFFFF" stroke-width="10" '
               'stroke-linecap="round" stroke-linejoin="round"/>')
    return '\n'.join(out)


def svg(body, bg=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{bg}{body}</svg>'


body = mark_body()
(brand / 'youcount-mark.svg').write_text(svg(body))
# icona: fondo bianco arrotondato, marchio all'86%
icon = svg(f'<g transform="translate(7 6) scale(.86)">{body}</g>', '<rect width="100" height="100" rx="22" fill="#FFFFFF"/>')
# maskable: fondo pieno, marchio nella zona sicura (cerchio centrale dell'80%)
mask = svg(f'<g transform="translate(19 18) scale(.62)">{body}</g>', '<rect width="100" height="100" fill="#FFFFFF"/>')
(icons / 'icon.svg').write_text(icon)
(icons / 'maskable.svg').write_text(mask)
for name, src in (('icon', icon), ('maskable', mask)):
    for size in (192, 512):
        subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), icons / f'{name}.svg',
                        '-o', icons / f'{name}-{size}.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '180', '-h', '180', icons / 'maskable.svg', '-o', icons / 'apple-touch-icon.png'], check=True)
# versione semplificata per 16-32 px (approvata dal panel): 6 tessere, fughe e spunta più spesse
SMALL = [('T0 T2 e L2', '#00A060'), ('T2 T3 R2 e', '#F0B048'), ('L2 e f L3', '#0870B0'), ('e R2 R3 f', '#C81858'),
         ('L3 f B2 B0', '#90B848'), ('f R3 B3 B2', '#30A8D8')]
P.update(dict(e=(50, 44), f=(50, 70)))
small = []
for names, col in SMALL:
    piece = Polygon([P[n] for n in names.split()]).intersection(SHAPE)
    if not piece.is_empty:
        small.append(f'<path d="{path(piece)}" fill="{col}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>')
small.append('<path d="M33 50 L46 62 L68 37" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>')
(brand / 'youcount-mark-small.svg').write_text(svg('\n'.join(small)))
for s in (16, 32, 48):
    src = brand / ('youcount-mark-small.svg' if s <= 32 else 'youcount-mark.svg')
    subprocess.run(['rsvg-convert', '-w', str(s), '-h', str(s), src, '-o', f'/tmp/yc-fav{s}.png'], check=True)
subprocess.run(['convert', '/tmp/yc-fav16.png', '/tmp/yc-fav32.png', '/tmp/yc-fav48.png', root / 'src/app/favicon.ico'], check=True)
for old in ('badge.svg',):
    (icons / old).unlink(missing_ok=True)
print('marchio e icone generati')
