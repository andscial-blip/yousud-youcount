-- 24/11: il committente non vuole il rosa. Tavolozza senza rosa, pesca e magenta (resta solo il corallo per gli allarmi).
-- Valori precedenti: #FFB0BB→#DCB4E6, #F0C2A0→#8FD3DC, #A45C73→#5A64B4, #CF93BE→#829678, #BB71A0→#6B5B95.
update public.projects set color = case color
  when '#FFB0BB' then '#DCB4E6' when '#F0C2A0' then '#8FD3DC' when '#A45C73' then '#5A64B4'
  when '#CF93BE' then '#829678' when '#BB71A0' then '#6B5B95' else color end
where color in ('#FFB0BB', '#F0C2A0', '#A45C73', '#CF93BE', '#BB71A0');
