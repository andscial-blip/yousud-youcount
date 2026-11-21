-- Colore fisso di ogni progetto (undicesimo giro, G4): salvato con il progetto e scelto in Impostazioni › Progetti.
-- I progetti esistenti ricevono il colore che avevano finora (ordine di creazione sulla tavolozza dei progetti).
alter table public.projects add column if not exists color text
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

with pal as (
  select array['#2F869F','#FFBAC4','#6B5B8E','#4A6F9C','#85BABB','#CC8990','#348983','#8488B8','#9C5B78','#C8BCDC','#789790','#95779C'] as c
), ord as (
  select id, row_number() over (partition by org_id order by created_at, id) - 1 as n from public.projects
)
update public.projects p set color = pal.c[(ord.n % 12) + 1]
from ord, pal where ord.id = p.id and p.color is null;
