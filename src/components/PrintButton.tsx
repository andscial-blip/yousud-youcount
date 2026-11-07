'use client';
import { Ico } from './Ui';
export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn noprint" onClick={() => window.print()}><Ico name="print" />{label}</button>;
}
