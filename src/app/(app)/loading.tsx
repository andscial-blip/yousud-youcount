// Mostrato subito al cambio di pagina, mentre il server prepara i dati: l'app risponde al tocco senza attese a vuoto.
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="sk sk-title" />
      <div className="sk-row"><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /></div>
      <div className="sk sk-panel" />
      <span className="sr-only">…</span>
    </div>
  );
}
