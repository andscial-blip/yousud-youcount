-- 0400 · Viste e funzioni per cruscotto e rendiconto
-- Contano solo i movimenti registrati o verificati; gli storni entrano con segno negativo.
-- I prospetti sono bozze: la conformità al D.M. 5 marzo 2020 la verifica il commercialista.

-- Righe contabili effettive, con la riga del rendiconto già risolta.
-- Uscite di un centro di costo di struttura: A1-A5 -> E1-E5 (oneri di supporto generale).
create or replace view public.v_ledger with (security_invoker = true) as
select m.org_id, m.id, m.ref, m.op_date, extract(year from m.op_date)::int as year,
       extract(month from m.op_date)::int as month, m.kind, m.status, m.sign,
       m.amount * m.sign as amount, m.currency, m.amount_eur * m.sign as amount_eur,
       m.account_id, m.to_account_id, m.to_amount * m.sign as to_amount,
       m.category_id, c.code as category_code, c.direction,
       m.project_id, p.name as project_name, p.kind as project_kind,
       case when m.kind = 'expense' and p.kind = 'structure' and c.report_line_key ~ '^A[1-5]$'
            then 'E' || substr(c.report_line_key, 2)
            else c.report_line_key end as report_line,
       m.counterparty_id, m.reverses_id
from public.movements m
left join public.categories c on c.id = m.category_id
left join public.projects p on p.id = m.project_id
where m.status in ('recorded', 'verified');

grant select on public.v_ledger to authenticated;

-- Saldi dei conti a una data: saldo d'apertura + entrate - uscite +/- giroconti, nella valuta del conto.
create or replace function public.account_balances(p_at date default current_date)
returns table (account_id uuid, code text, name_it text, currency char(3), kind text, location text,
               opening_balance numeric, movements_in numeric, movements_out numeric, balance numeric,
               unverified integer)
language sql stable security definer set search_path = '' as $$
  with flows as (
    select m.account_id as acc,
           case when m.kind = 'income' then m.amount * m.sign else 0 end as fin,
           case when m.kind in ('expense', 'transfer') then m.amount * m.sign else 0 end as fout,
           (m.status = 'recorded')::int as unv
    from public.movements m
    where m.org_id = app.me_org() and m.status <> 'draft' and m.op_date <= p_at
    union all
    select m.to_account_id, m.to_amount * m.sign, 0, (m.status = 'recorded')::int
    from public.movements m
    where m.org_id = app.me_org() and m.status <> 'draft' and m.kind = 'transfer' and m.op_date <= p_at
  )
  select a.id, a.code, a.name_it, a.currency, a.kind, a.location, a.opening_balance,
         coalesce(sum(f.fin), 0), coalesce(sum(f.fout), 0),
         a.opening_balance + coalesce(sum(f.fin), 0) - coalesce(sum(f.fout), 0),
         coalesce(sum(f.unv), 0)::int
  from public.accounts a
  left join flows f on f.acc = a.id
  where a.org_id = app.me_org() and app.me_role() is not null
  group by a.id
  order by a.sort, a.code
$$;

-- Rendiconto per cassa (bozza): importi in EUR per riga, anno richiesto e anno precedente.
create or replace function public.report_cash_statement(p_year int)
returns table (direction public.flow_dir, section text, section_it text, key text, name_it text, sort int,
               amount_eur numeric, amount_eur_prev numeric, rows_count int, missing_rate int)
language sql stable security definer set search_path = '' as $$
  select rl.direction, rl.section, rl.section_it, rl.key, rl.name_it, rl.sort,
         coalesce(sum(l.amount_eur) filter (where l.year = p_year), 0),
         coalesce(sum(l.amount_eur) filter (where l.year = p_year - 1), 0),
         count(l.id) filter (where l.year = p_year)::int,
         count(l.id) filter (where l.year = p_year and l.amount_eur is null)::int
  from public.report_lines rl
  left join public.v_ledger l
         on l.org_id = rl.org_id and l.report_line = rl.key and l.direction = rl.direction
        and l.kind <> 'transfer' and l.year in (p_year, p_year - 1)
  where rl.org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','read_only')
  group by rl.id
  order by rl.direction desc, rl.sort
$$;

-- Movimenti senza riga di rendiconto (codici da classificare, es. 999): da sistemare prima della chiusura.
create or replace function public.report_unclassified(p_year int)
returns table (id uuid, ref text, op_date date, category_code text, amount_eur numeric)
language sql stable security definer set search_path = '' as $$
  select l.id, l.ref, l.op_date, l.category_code, l.amount_eur
  from public.v_ledger l
  where l.org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','read_only')
    and l.year = p_year and l.kind <> 'transfer' and l.report_line is null
  order by l.op_date
$$;

grant execute on function public.account_balances(date), public.report_cash_statement(int),
  public.report_unclassified(int) to authenticated;
revoke execute on function public.account_balances(date), public.report_cash_statement(int),
  public.report_unclassified(int) from public, anon;
