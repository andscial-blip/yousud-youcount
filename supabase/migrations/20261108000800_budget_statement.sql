-- 0800 · Preventivo nello schema del rendiconto per cassa (modello D, DM 5 marzo 2020)
-- Stessa regola del consuntivo (v_ledger): voce del rendiconto dal codice contabile; le uscite A1–A5 dei progetti
-- di struttura vanno nelle corrispondenti E1–E5 (supporto generale); il gruppo E9 (saldi iniziali) resta fuori.
-- Righe senza voce del rendiconto: una riga «da classificare» per direzione, così il totale torna con il preventivo.
create or replace function public.budget_statement(p_year int, p_budget uuid default null)
returns table (direction public.flow_dir, section text, section_it text, section_fr text, key text,
               name_it text, name_fr text, sort int, budget_eur numeric)
language sql stable security definer set search_path = '' as $$
  with b as (
    select coalesce(p_budget, app.current_budget(app.me_org(), p_year)) as id
  ),
  it as (
    select c.direction,
           case when g.code = 'E9' then null
                when c.direction = 'out' and p.kind = 'structure' and c.report_line_key ~ '^A[1-5]$'
                then 'E' || substr(c.report_line_key, 2)
                else c.report_line_key end as line,
           g.code = 'E9' as out_of_report,
           i.amount_eur
    from public.budget_items i
    join b on i.budget_id = b.id
    join public.categories c on c.id = i.category_id
    left join public.category_groups g on g.id = c.group_id
    left join public.projects p on p.id = i.project_id
    where i.org_id = app.me_org()
  ),
  lines as (
    select rl.direction, rl.section, rl.section_it, rl.section_fr, rl.key, rl.name_it, rl.name_fr, rl.sort,
           coalesce(sum(it.amount_eur), 0) as budget_eur
    from public.report_lines rl
    left join it on it.line = rl.key and it.direction = rl.direction
    where rl.org_id = app.me_org()
    group by rl.id
    union all
    select it.direction, '?', 'Da classificare', 'À classer', null, 'Codici senza voce del rendiconto',
           'Codes sans poste du compte rendu', 9999, sum(it.amount_eur)
    from it where it.line is null and not it.out_of_report
    group by it.direction
  )
  select * from lines
  where app.has_role('super_admin','admin','responsabile','read_only')
  order by direction desc, sort
$$;
revoke all on function public.budget_statement(int, uuid) from public, anon;
grant execute on function public.budget_statement(int, uuid) to authenticated;
