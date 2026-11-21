-- Giro 12 (7-7): nuova tavolozza dei progetti, più distinta. Cambia solo i progetti che hanno ancora il colore assegnato
-- in automatico dalla migrazione project_color (stessa posizione nella vecchia tavolozza): quelli scelti a mano restano.
with old as (select array['#2F869F','#FFBAC4','#6B5B8E','#4A6F9C','#85BABB','#CC8990','#348983','#8488B8','#9C5B78','#C8BCDC','#789790','#95779C'] as c), nw as (select array['#8A739D','#658552','#79D1F9','#FFB0BB','#A45C73','#BA9DBB','#427B78','#2279A5','#BE8088','#3AA8C5','#789790','#95779C'] as c),
ord as (select id, color, row_number() over (partition by org_id order by created_at, id) - 1 as n from public.projects)
update public.projects p set color = nw.c[(ord.n % 12) + 1]
from ord, old, nw where ord.id = p.id and p.color = old.c[(ord.n % 12) + 1];
