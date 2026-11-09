'use client';
// Stampa: prima apre tutte le sezioni richiudibili, così il PDF contiene tutto.
export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn no-print" onClick={() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
    window.print();
  }}>{label}</button>;
}
