#!/usr/bin/env python3
"""Icone YouCount: il mappamondo del logo YouSud (public/brand/yousud-globe.png, ritagliato dal logo
originale senza la scritta, come richiesto da Andrea) con un distintivo contabile in basso a sinistra (a destra coprirebbe il Madagascar):
ricevuta con spunta di verifica. Il mappamondo non viene ridisegnato.
Richiede rsvg-convert e ImageMagick (convert)."""
import base64, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
logo = base64.b64encode((root / 'public/brand/yousud-globe.png').read_bytes()).decode()
out = root / 'public/icons'
out.mkdir(exist_ok=True)

BADGE = '''<g transform="translate({x} {y}) scale({s})">
  <circle cx="20" cy="20" r="19" fill="#44546A" stroke="#FFFFFF" stroke-width="2.5"/>
  <path d="M12 8.5h16v22l-2.7-1.8-2.6 1.8-2.7-1.8-2.7 1.8-2.6-1.8L12 30.5z" fill="#FFFFFF"/>
  <path d="M15.5 13.5h9M15.5 17.5h9M15.5 21.5h5" stroke="#5E6B7C" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="28.5" cy="27.5" r="7" fill="#E8BE5A" stroke="#44546A" stroke-width="1.6"/>
  <path d="M25.4 27.6l2.2 2.2 3.9-4.2" stroke="#1C2633" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>'''

def svg(maskable: bool) -> str:
    # icona "any": angoli arrotondati; "maskable": pieno, logo nella zona sicura (80% centrale)
    bg = '<rect width="100" height="100" fill="#FFFFFF"/>' if maskable else \
         '<rect width="100" height="100" rx="22" fill="#FFFFFF"/>'
    ls, gx, gy = (60, 22, 14) if maskable else (76, 16, 6)
    bs, bx, by = (0.6, 13, 61) if maskable else (0.72, 2, 70)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
{bg}<image x="{gx}" y="{gy}" width="{ls}" height="{ls}" xlink:href="data:image/png;base64,{logo}"/>
{BADGE.format(x=bx, y=by, s=bs)}</svg>'''

for name, mask in (('icon', False), ('maskable', True)):
    (out / f'{name}.svg').write_text(svg(mask))
    for size in (192, 512):
        subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), out / f'{name}.svg', '-o', out / f'{name}-{size}.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '180', '-h', '180', out / 'maskable.svg', '-o', out / 'apple-touch-icon.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '48', '-h', '48', out / 'icon.svg', '-o', '/tmp/yc-fav48.png'], check=True)
subprocess.run(['convert', '/tmp/yc-fav48.png', root / 'src/app/favicon.ico'], check=True)
# marchio per l'intestazione: mappamondo + distintivo, fondo trasparente
(root / 'public/brand/youcount-mark.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
<image x="14" y="0" width="86" height="86" xlink:href="data:image/png;base64,{logo}"/>{BADGE.format(x=0, y=58, s=1.05)}</svg>''')
(out / 'badge.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' + BADGE.format(x=0, y=0, s=1) + '</svg>')
print('icone generate in', out)
