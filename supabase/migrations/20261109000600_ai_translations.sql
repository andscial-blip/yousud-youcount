-- Traduzione automatica della descrizione dei movimenti (italiano ↔ francese) fatta con l'AI.
-- Tabella a parte: il movimento registrato o verificato non cambia; la traduzione si rifà se la descrizione cambia
-- (si conserva il testo d'origine tradotto). La vede solo chi vede il movimento.
create table public.movement_translations (
  movement_id uuid primary key references public.movements(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete restrict,
  src_lang    text not null check (src_lang in ('it', 'fr')),
  source      text not null,
  it          text not null check (length(it) <= 600),
  fr          text not null check (length(fr) <= 600),
  model       text,
  updated_at  timestamptz not null default now()
);
alter table public.movement_translations enable row level security;
create policy movement_translations_select on public.movement_translations for select to authenticated
  using (org_id = (select app.me_org()) and exists (select 1 from public.movements m where m.id = movement_id));
grant select on public.movement_translations to authenticated;

-- p: [{ id, src, it, fr }]; scrive solo per i movimenti che l'utente vede, chi non è in sola lettura
create or replace function public.movement_translations_save(p jsonb, p_model text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_m public.movements; v_n int := 0;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  for r in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    select * into v_m from public.movements where id = (r->>'id')::uuid and org_id = app.me_org();
    if not found or not app.can_see_movement(v_m) then continue; end if;
    if coalesce(r->>'src', '') not in ('it', 'fr') or length(trim(coalesce(r->>'it', ''))) = 0 or length(trim(coalesce(r->>'fr', ''))) = 0 then continue; end if;
    insert into public.movement_translations(movement_id, org_id, src_lang, source, it, fr, model, updated_at)
    values (v_m.id, v_m.org_id, r->>'src', v_m.description, left(trim(r->>'it'), 600), left(trim(r->>'fr'), 600), p_model, now())
    on conflict (movement_id) do update set src_lang = excluded.src_lang, source = excluded.source, it = excluded.it,
      fr = excluded.fr, model = excluded.model, updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.movement_translations_save(jsonb, text) from public, anon;
grant execute on function public.movement_translations_save(jsonb, text) to authenticated;
