-- Verifica finale 22/11: il colore #BE8088 (rosa antico) era troppo vicino al corallo d'allarme (ΔE 12,4).
-- Solo i progetti che lo avevano assegnato in automatico passano al nuovo colore della tavolozza; prima: #BE8088.
update public.projects set color = '#A8C078' where color = '#BE8088';
