-- «Oggi» nel database come nell'app: ora di Antananarivo (revisione 21/11).
-- Prima il database usava UTC: tra le 00:00 e le 03:00 malgasce current_date era ancora il giorno prima, quindi una conta di cassa,
-- un rimborso o una riconciliazione con la data di oggi risultavano «nel futuro», e i saldi «a oggi» escludevano i movimenti di oggi.
-- Le date e gli istanti salvati non cambiano: cambia solo il fuso con cui il database calcola current_date e mostra gli orari.
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'Indian/Antananarivo');
end $$;
