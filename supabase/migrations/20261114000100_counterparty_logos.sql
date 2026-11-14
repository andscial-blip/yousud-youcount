-- Logo del finanziatore (richiesta del 14/11): un'immagine piccola per controparte, mostrata nelle schede dei finanziamenti.
-- Sta in una tabella a parte (non appesantisce gli elenchi delle controparti) come immagine già ridotta dal browser a 256 px
-- (PNG, JPEG o WebP in base64; niente SVG). Si legge dentro l'organizzazione; si scrive solo con la funzione, da responsabili e amministratori.
create table public.counterparty_logos (
  counterparty_id uuid primary key references public.counterparties(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete restrict,
  image           text not null check (image ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and length(image) <= 200000),
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz not null default now()
);
alter table public.counterparty_logos enable row level security;
create policy counterparty_logos_select on public.counterparty_logos for select to authenticated using (org_id = app.me_org());
revoke insert, update, delete on public.counterparty_logos from anon, authenticated;

-- Imposta o toglie (p_image null) il logo di una controparte.
create or replace function public.counterparty_logo_set(p_id uuid, p_image text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org();
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if not exists (select 1 from public.counterparties c where c.id = p_id and c.org_id = v_org) then perform app.fail('not_found', 'controparte'); end if;
  if p_image is null or p_image = '' then
    delete from public.counterparty_logos where counterparty_id = p_id;
    return;
  end if;
  if length(p_image) > 200000 or p_image !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then
    perform app.fail('invalid', 'immagine non valida o troppo grande');
  end if;
  insert into public.counterparty_logos(counterparty_id, org_id, image, updated_by) values (p_id, v_org, p_image, auth.uid())
  on conflict (counterparty_id) do update set image = excluded.image, updated_by = excluded.updated_by, updated_at = now();
end $$;
revoke execute on function public.counterparty_logo_set(uuid, text) from public, anon;
grant execute on function public.counterparty_logo_set(uuid, text) to authenticated;
