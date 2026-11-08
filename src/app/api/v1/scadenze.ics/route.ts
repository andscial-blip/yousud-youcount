import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normLang } from '@/lib/i18n';
import { ruleItems } from '@/lib/deadline-rules';

// Scadenze aperte in formato iCalendar, da importare nel calendario (Google, Outlook, telefono):
// un promemoria per evento il giorno prima. File scaricato con i permessi dell'utente collegato.
export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (l: string) => { const out: string[] = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join('\r\n'); };

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'non autenticato' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('lang, active, role').eq('id', auth.user.id).maybeSingle();
  if (!me?.active) return NextResponse.json({ error: 'account non attivo' }, { status: 403 });
  const fr = normLang(me.lang) === 'fr';
  const today = new Date().toISOString().slice(0, 10), Y = Number(today.slice(0, 4));
  const { data: saved } = await supabase.from('deadlines').select('id, rule_key, title, due_date, status, notes').gte('due_date', today).order('due_date');
  const staff = ['super_admin', 'admin', 'responsabile', 'read_only'].includes(me.role);
  const incs = staff ? await Promise.all([Y - 1, Y].map((y) => supabase.rpc('income_of_year', { p_year: y }))) : [];
  const inc = (y: number) => Number((y === Y - 1 ? incs[0]?.data : incs[1]?.data) ?? 0);
  const byRule = new Map((saved ?? []).filter((d) => d.rule_key).map((d) => [d.rule_key as string, d]));
  const ev: { uid: string; date: string; title: string; desc: string }[] = [];
  for (const d of (saved ?? []).filter((x) => !x.rule_key && x.status === 'open')) ev.push({ uid: d.id, date: d.due_date, title: d.title, desc: d.notes ?? '' });
  if (staff) for (const r of ruleItems([Y, Y + 1], inc)) {
    const s = byRule.get(r.rule_key);
    const dt = s?.due_date ?? r.date;
    if (!r.applies || dt < today || (s && s.status !== 'open')) continue;
    ev.push({ uid: r.rule_key, date: dt, title: fr ? r.fr : r.it, desc: fr ? r.dfr : r.dit });
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YouSud ODV//YouCount//IT', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${fr ? 'Échéances YouCount' : 'Scadenze YouCount'}`];
  for (const e of ev) {
    const d = e.date.replace(/-/g, ''), next = new Date(`${e.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@youcount.yousud`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`, fold(`SUMMARY:${esc(e.title)}`), fold(`DESCRIPTION:${esc(e.desc)}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', fold(`DESCRIPTION:${esc(e.title)}`), 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new NextResponse(lines.join('\r\n') + '\r\n', { headers: {
    'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${fr ? 'echeances' : 'scadenze'}-youcount.ics"`, 'cache-control': 'no-store' } });
}
