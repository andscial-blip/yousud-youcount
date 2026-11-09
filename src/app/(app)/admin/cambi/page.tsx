import { redirect } from 'next/navigation';

// La pagina dei tassi è ora in Conti → Tassi di cambio.
export default function OldRates() { redirect('/cambi'); }
