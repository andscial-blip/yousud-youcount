'use client';
// Caricamento del logo di un finanziatore: l'immagine scelta viene ridotta nel browser a 256 px (PNG, sfondo trasparente)
// e inviata già pronta; niente SVG. Anteprima prima di salvare.
import { useRef, useState } from 'react';

export function DonorLogoUpload({ action, lang, donorId, ret, current }: {
  action: (form: FormData) => void | Promise<void>; lang: 'it' | 'fr'; donorId: string; ret: string; current: string | null;
}) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pick = (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setErr(L('Formato non ammesso: usa PNG, JPEG o WebP.', 'Format non admis : utilisez PNG, JPEG ou WebP.')); return; }
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
      let out = '';
      for (const side of [256, 192, 128]) {
        const k = Math.min(1, side / Math.max(el.width, el.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(el.width * k)); c.height = Math.max(1, Math.round(el.height * k));
        c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height);
        out = c.toDataURL('image/png');
        if (out.length <= 190000) break;
      }
      URL.revokeObjectURL(url);
      if (out.length > 190000) setErr(L('Immagine troppo pesante anche ridotta: scegline una più semplice.', 'Image trop lourde même réduite : choisissez-en une plus simple.'));
      else setImg(out);
    };
    el.onerror = () => { URL.revokeObjectURL(url); setErr(L('Non riesco a leggere l\'immagine.', 'Impossible de lire l\'image.')); };
    el.src = url;
  };
  const shown = img ?? current;
  return (
    <form action={action} className="dlogo">
      <input type="hidden" name="donor_id" value={donorId} /><input type="hidden" name="ret" value={ret} />
      <input type="hidden" name="image" value={img ?? ''} />
      <span className={`dmark ${shown ? 'has' : 'none'}`} style={{ width: 64, height: 64 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown} alt="" /> : null}
      </span>
      <div className="dlogo-b">
        <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label={L('Scegli il file del logo', 'Choisir le fichier du logo')}
          onChange={(e) => pick(e.target.files?.[0])} />
        <div className="dlogo-a">
          <button type="button" className="btn" onClick={() => input.current?.click()}>{shown ? L('Cambia immagine', 'Changer l\'image') : L('Scegli immagine', 'Choisir une image')}</button>
          {img ? <button type="submit" className="btn primary">{L('Salva il logo', 'Enregistrer le logo')}</button>
            : current ? <button type="submit" className="btn danger" name="remove" value="1">{L('Togli il logo', 'Retirer le logo')}</button> : <span />}
        </div>
        <p className="muted small">{err ?? L('PNG, JPEG o WebP: viene ridotta a 256 px. Vale per tutti i finanziamenti di questo finanziatore.', 'PNG, JPEG ou WebP : elle est réduite à 256 px. Vaut pour tous les financements de ce bailleur.')}</p>
      </div>
    </form>
  );
}
