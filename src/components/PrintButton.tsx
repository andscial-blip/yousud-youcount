'use client';
export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn noprint" onClick={() => window.print()}>{label}</button>;
}
