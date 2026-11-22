# YouCount: verifica finale di conferma (22/11/2026)

Copia locale su localhost:3313. Prove in `/tmp/yc-final/work/conf/`.

## Difetti aperti al diciannovesimo giro

| Difetto | Esito | Prova |
|---|---|---|
| Q1 ciambelle Panoramica | CHIUSO | Le due SVG vanno da y 908 a 1118 e le legende da 1138 a 1314, identiche (`q1_panoramica.png`, sa1440) |
| Q2 nome e «1 persona» | CHIUSO | Distanza 8 px in IT (107→115) e in FR (100→108); il nome finisce con i puntini (`it375_anticipi.png`, `fr375_…`) |
| Q3 Dashboard operatore | CHIUSO | Le due colonne finiscono entrambe a y 804 (`op_dash1440.png`) |
| Q4 «modifica →» | CHIUSO | Sta su una riga a destra del titolo (`it375_q4_progetto.png`) |
| Q5 mini-legende KPI | **APERTO (cambiato)** | Non va più a capo, ma in «Da documentare» l'etichetta di sinistra è tagliata con i puntini: «con …» e «avec j…» (46 px visibili su 91), quindi il numero non si legge. In Anticipi la legenda è a posto (`it375_rimborsi.png`, `fr375_rimborsi.png`) |
| Q6 Progetti «Previsto e speso» | **PARZIALE** | Le barre ora stanno sotto il nome e arrivano a 336 px. La scala però è ancora lineare: StreetFood 12 px, Sport 4 px (`q6_progetti.png`) |
| Q7 KPI vuoti in Conti (operatore) | CHIUSO | Le due schede hanno la stessa struttura (etichetta, valore, barra 38, legenda 18, piede 22) e sono alte 168 px |
| Q8 verdi dei gruppi | CHIUSO | ΔE00 dal colore #5FB8A3: 16,3 (#87B96E) e 23,7 (#6E8A3C) |
| Q9 pastiglie /nuovo | CHIUSO | Tutte e 6 misurano 63×167 px (`q9_nuovo.png`) |
| N8 (FR) «Postes de dépense» | CHIUSO | Le voci si distribuiscono sull'altezza; il vuoto in fondo resta tra 17 e 45 px in 7 progetti su 8. Il progetto senza spese mostra «Aucune donnée.» (`n8_fr_p5.png`, `n8_fr_p7.png`) |
| N3 numeri staccati | CHIUSO | E1–E4 stanno su una riga (21 px); «1 con motivo» e «1 avec motif» restano uniti (`n3_rimborsi1440.png`, `fr375_rimborsi.png`) |
| J6 colori progetti | CHIUSO | Piccolino è #A8C078 e tra i progetti non c'è più il lilla (ΔE00 minimo dal Madagascar 26,6). Dal corallo d'allarme il minimo è 13,8, con il rosa #FFB0BB di Spese generali |
| W1 | CHIUSO | Vale la prova di Q3 |
| W2 (FR) | CHIUSO | Operatore in FR a 375: «Caisses et Mvola» e «Avances en cours» hanno l'importo alla stessa y (483) (`w2_fr_conti375.png`) |
| W3 | SCELTA VOLUTA | L'aiuto dice: «gli anticipi del Madagascar (il proprio è proposto per primo; gli altri servono a registrare le spese di chi non usa l'app)» |
| W4 | CHIUSO | Ora dice «per salvarla basta l'importo». «Premi «+ Nuovo movimento»» c'è ancora, ma con l'indicazione «l'operatore trova in Dashboard «Registra una spesa»» |
| W5 | **PARZIALE** | Fatto: su 6 tipi c'è la pastiglia «prepari la bozza, la emette un responsabile» e, dopo il salvataggio, la banda «Bozza salvata: la emette un responsabile o un amministratore» (`w5_bozza375.png`). Manca ancora: il pannello d'aiuto non ha il riassunto per l'operatore e comincia con «Su telefono…» e «+ Emetti» |
| W6 | CHIUSO | Dopo «Genera il PDF», l'elenco mostra MOV‑2026‑006 come «Autocertificazione da firmare» (`w6d.mjs`) |
| W7 | CHIUSO | Mvola compare nella scheda «Casse e Mvola» e nella tabella. Resta un dettaglio: l'aiuto dice ancora «casse in contanti» |
| W8 | **PARZIALE** | La riga in MGA ora c'è, ma accanto a «Mvola (mobile money)» si legge «‑15.944.900 MGA», che sembra il saldo di Mvola. È invece il totale delle due casse: Mvola è +4.496.400 (`op_conti1440.png`) |
| W9 | CHIUSO | Lo stesso termine in tutte e tre le pagine: «Payée de ma poche», «Dépense payée de ma poche», «payées de votre poche» |
| N-2 | CHIUSO lato client | Browser sul fuso di Antananarivo all'01:30 del 23/11: /nuovo e la conta di cassa propongono 2026‑11‑23 (`n2.mjs`). Lato server ci sono i test unitari, che qui non ho verificato |

## Audit (audit.mjs)

| Misura | Esito |
|---|---|
| 1440 super_admin | Nessuna riga sfalsata. Unico vuoto: il calendario di Scadenze, che non conta |
| 1440 admin_fr | Come sopra. Il server si è riavviato durante la misura: ho aspettato e rilanciato |
| 1440 operatore | Segnala solo stati vuoti illustrati con pulsante (Dashboard e Documenti emessi) e il calendario, che non contano |
| 768 super_admin | Dashboard «Entrate e uscite»: VUOTO INTERNO di 56 px, proprio alla soglia. È il margine sopra le barre, non un riquadro vuoto (`sa768_dash__2.png`) |
| 375 operatore | Solo stati vuoti con pulsante. /rimborsi è andato in timeout; controllato a mano, nessun vuoto (`op375_rimborsi__1.png`) |

Nessuna riga sfalsata (ALTEZZE e COLONNE) in nessuna delle cinque misure.

## Errori gravi
Nessuno. Nota: il riavvio del server ha ripristinato i dati dimostrativi e ha cancellato i movimenti e le bozze di prova. Dipende dalla copia locale, non dall'app.

## Conclusione
Non confermato del tutto. Restano aperti: Q5 (numero nascosto dai puntini), Q6 (barre brevissime), W5 (riassunto per l'operatore nel pannello d'aiuto) e W8 (MGA accanto a «Mvola»).
