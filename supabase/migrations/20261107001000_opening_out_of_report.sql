-- 1000 · I saldi iniziali (gruppo E9, codice E904 «Avanzo dell'anno precedente») non sono ricavi:
-- come nel Gestionale restano fuori dal rendiconto e non contano tra i codici da classificare.
create or replace view public.v_ledger with (security_invoker = true) as
select m.org_id, m.id, m.ref, m.op_date, extract(year from m.op_date)::int as year,
       extract(month from m.op_date)::int as month, m.kind, m.status, m.sign,
       m.amount * m.sign as amount, m.currency, m.amount_eur * m.sign as amount_eur,
       m.account_id, m.to_account_id, m.to_amount * m.sign as to_amount,
       m.category_id, c.code as category_code, c.direction,
       m.project_id, p.name as project_name, p.kind as project_kind,
       case when g.code = 'E9' then null
            when m.kind = 'expense' and p.kind = 'structure' and c.report_line_key ~ '^A[1-5]$'
            then 'E' || substr(c.report_line_key, 2)
            else c.report_line_key end as report_line,
       m.counterparty_id, m.reverses_id,
       g.code = 'E9' as out_of_report
from public.movements m
left join public.categories c on c.id = m.category_id
left join public.category_groups g on g.id = c.group_id
left join public.projects p on p.id = m.project_id
where m.status in ('recorded', 'verified');

create or replace function public.report_unclassified(p_year int)
returns table (id uuid, ref text, op_date date, category_code text, amount_eur numeric)
language sql stable security definer set search_path = '' as $$
  select l.id, l.ref, l.op_date, l.category_code, l.amount_eur
  from public.v_ledger l
  where l.org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','read_only')
    and l.year = p_year and l.kind <> 'transfer' and l.report_line is null and not coalesce(l.out_of_report, false)
  order by l.op_date
$$;

update public.categories c set report_line_key = null
from public.category_groups g where g.id = c.group_id and g.code = 'E9' and c.report_line_key is not null;
