-- 24/11: Antanetibe (prima #DCB4E6, troppo vicino a Sport #CAC0F0) e StreetFood (prima #658552, oliva tendente al marrone)
update public.projects set color = '#8FD3DC' where name = 'École Antanetibe' and color = '#DCB4E6';
update public.projects set color = '#1D7954' where name = 'StreetFood' and color = '#658552';
