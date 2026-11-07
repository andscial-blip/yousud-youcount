export const metadata = { title: 'Nuovo movimento' };

// Tappa 4c: foto o file → miglioramento immagine → PDF → lettura IA → verifica campo per campo.
export default function NewMovement() {
  return (
    <div className="stack">
      <h1 style={{ fontSize: 22 }}>Nuovo movimento</h1>
      <div className="note">
        In costruzione (tappa 4c): fotografa o carica il giustificativo, l&apos;app migliora l&apos;immagine, ne fa un PDF,
        propone i campi letti e tu li verifichi uno per uno prima di registrare.
      </div>
    </div>
  );
}
