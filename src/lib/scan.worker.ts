// Elaborazione della foto del giustificativo fuori dal thread principale (25/11): raddrizza, migliora e comprime in JPEG
// mentre chi registra continua a compilare il modulo. Riceve l'immagine già ridotta (≤ 2000 px) e i quattro angoli.
import { enhance, inset, warp, type Img, type Pt, type ScanMode } from './scan';

type In = { id: string; img: Img; corners: Pt[]; mode: ScanMode };

async function jpeg(img: Img, q: number): Promise<Blob> {
  const c = new OffscreenCanvas(img.width, img.height);
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.convertToBlob({ type: 'image/jpeg', quality: q });
}

self.onmessage = async (e: MessageEvent<In>) => {
  const { id, img, corners, mode } = e.data;
  try {
    const r = enhance(warp(img, inset(corners)), mode);
    const [scan, original] = await Promise.all([jpeg(r, mode === 'photo' ? 0.8 : 0.78), jpeg(img, 0.72)]);
    (self as unknown as Worker).postMessage({ id, ok: true, scan, original });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
