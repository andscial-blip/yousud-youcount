# YouCount · revisione visiva finale (16/11/2026)

Revisore indipendente, solo da schermate e misure sul DOM reso. Copertura: 27 pagine × 3 larghezze (375, 768, 1440) in italiano (super_admin) + /login alle tre larghezze + 6 pagine in francese (admin_fr) a 375 e 768. Prove in `/tmp/yc-final/work/v/` (`d_`=1440, `t_`=768, `m_`=375, `fm_`/`ft_`=francese; `.json` = misure). Script: `work/vbatch.mjs`, `work/agg.py`.

## Misure (verificate, 27 pagine a 1440)

| Elemento | Valori distinti trovati |
|---|---|
| Corpi di testo | 9: 12 · 12,5 · 13 · 14 · 16 · 20 · 24 · 28 · 32 px (12,5 e 32 compaiono in una sola pagina) |
| Pesi | 5: 400 · 500 · 600 · 700 · 900 |
| Raggi | 6: 4 · 8 · 10 · 14 px · pillola · cerchio |
| Altezze pulsante | 8: 30 · 32 · 34 · 38 · 40 · 42 · 44 · 46 px (a 375: 34 · 40 · 44 · 52) |
| Altezze campo | input 34/40/41/48/54 · select 38/40 |
| Famiglie | IBM Plex Sans + Condensed; corsivi trovati: 0 |
| Scorrimento orizzontale di pagina | 0 casi su 27 pagine × 3 larghezze |
| Testo assi grafici (reale) | 1440: 9,8–11,3 px · 768: 12,6–13,2 px · 375: 10,3–11,9 px · etichetta al centro delle ciambelle 9,2 px |
| Colori grafici | entrate rgb(30,43,60) (in Dashboard 46,61,82) · uscite (232,190,90) · saldo (95,184,163) · previsto (91,143,214) |

## Voti

| Area | Voto |
|---|---|
| Identità e direzione artistica | 8,5 |
| Design system | 7,5 |
| UI | 8 |
| Grafici | 7,5 |
| Versione desktop | 8,5 |
| Versione tablet | 7,5 |
| Versione mobile | 8 |
| Coerenza visiva complessiva | 8 |
| Professionalità percepita | 8,5 |

## Giudizi

**Identità (8,5).** Funziona: blu notte + pastelli coerenti ovunque, una sola famiglia tipografica, niente corsivo né marrone, login e documento emesso curati. Non funziona: due rossi (163,54,46 e 178,59,50), quattro grigi di testo; il blu «previsto» e le barrette blu di Movimenti sono più saturi del resto. Per il 10: un solo rosso e due grigi; desaturare il blu «previsto».

**Design system (7,5).** Funziona: schede, pillole di stato, KPI a 4, schede-tab identiche in tutte le pagine. Non funziona: 8 altezze di pulsante, tre altezze di selettore a segmenti (34/40/46), campi 40/41/54, intestazioni di pannello con e senza icona, un'icona mancante (V09), «+ Emetti» con il più scritto a testo. Per il 10: tre altezze di pulsante (32/38/44) e una sola per i segmenti; eliminare 12,5 e 32 px; icona in ogni intestazione o in nessuna.

**UI (8).** Funziona: gerarchia chiara, importi allineati a destra, tabelle leggibili, euro grande/ariary piccolo in registro e dettaglio. Non funziona: V04, V05, V12, V13, V14, V19, V20, stati vuoti di solo testo (V23). Per il 10: correggere quei punti a 1440 e 375.

**Grafici (7,5).** Funziona: regola entrate/uscite/saldo rispettata in Dashboard, Analisi, Report, Progetto; rosso solo sugli sforamenti; stesso colore per lo stesso progetto e gruppo tra Dashboard, Preventivo, Analisi, Progetti; scale con zero. Non funziona: V03 (colori che cambiano con la lingua), V07 (due grammatiche di barra nella stessa pagina), V10, V15. Per il 10: colore legato all'identificativo e non all'etichetta; una sola convenzione per la tacca; assi ≥ 11 px a 1440.

**Desktop (8,5).** Solido e ordinato. Per il 10: V09, V12, V13, V14, V06.

**Tablet (7,5).** Barra laterale compatta ben risolta; cede sulle tabelle: V01, V02, V06, V08. Per il 10: passare a schede (come a 375) le tabelle di /cambi e «per codice» sotto i 900 px.

**Mobile (8).** Nessuno scorrimento orizzontale, tabelle convertite in schede, barra azioni fissa nel documento. Non funziona: V11 (densità), V10, V18, V21. Per il 10: riga movimento su due livelli e KPI comprimibili.

**Coerenza (8).** Struttura identica tra le sezioni; incoerenze di dettaglio (V03, V07, V16, V20).

**Professionalità (8,5).** Impressione: prodotto finito e credibile per un'associazione; i difetti sono di rifinitura, nessuno falsa i dati.

## Difetti

| ID | Gr. | Pagina | Largh. | Descrizione | Prova |
|---|---|---|---|---|---|
| V01 | P2 | /cambi | 768 | Tabella con scorrimento orizzontale (634/713 px); colonna «Fonte» larga ~55 px, testo su 5 righe, righe alte 127 px | t_cambi__2.png, t_cambi.json |
| V02 | P2 | /analisi?vista=budget | 768 | Barre «per codice» ridotte a ~25 px: illeggibili | t_analisibud__2.png, __3.png |
| V03 | P2 | /conti, /finanziamenti | 375 | Colori delle barre KPI diversi tra italiano e francese (Italia verde oliva/corallo → rosa/grigio; Anticipi rosa → corallo; Concesso lilla → grigio-azzurro). Causa non verificata | m_conti__1.png vs fm_conti__1.png; d_finanz__1.png vs fm_finanz__1.png |
| V04 | P2 | /rimborsi, /anticipi | tutte | Ariary grande ed euro piccolo o assente («45.000 MGA» / «≈ 8,90 €»; «1.162.500 MGA»): contrario alla regola del committente | m_rimborsi__2.png, d_rimborsi__1.png, d_anticipi__1.png |
| V05 | P2 | /finanziamenti | tutte | Titolo della scheda troncato con i puntini | d_finanz__1.png, m_finanz__2.png |
| V06 | P2 | /scadenze | 768 (P3 a 1440) | Etichette del calendario troncate («Modello 7…», «Rendicont…») | t_scadenze__1.png, d_scadenze__1.png |
| V07 | P2 | /analisi?vista=budget | tutte | Stessa pagina, due convenzioni: tacca = 100 % del preventivo (gruppi) e tacca = anno trascorso (codici); pillola «oltre il preventivo» gialla, «3 codici oltre» rossa | d_analisibud__1.png, __2.png |
| V08 | P2 | / (francese) | 768 | Intestazione: icona di ricerca assente e «IA» a ridosso del titolo «Tableau de bord» | ft_home__1.png |
| V09 | P2 | /guida | 1440 | Ultima voce («Copiare giustificativi… su Google Drive») con riquadro icona vuoto | d_guida__3.png |
| V10 | P2 | /cambi | 375 | Etichette dell'asse «Nov» e «Dic» quasi attaccate | work/crop_cambi375.png |
| V11 | P2 | /movimenti | 375 | Righe fino a ~190 px (tre file di pillole): circa 4 movimenti per schermata; i KPI occupano tutta la prima | m_movimenti__1.png, __2.png |
| V12 | P3 | /movimenti | 1440 | Numero «DEMO-2026-1008» spezzato su due righe; righe alte 82 px | d_movimenti__1.png |
| V13 | P3 | /preventivo | 1440 | Ciambelle Uscite/Entrate fuori asse di 14 px; nelle righe di gruppo etichetta 4 px sopra l'importo e filetto con scalino di 1 px | d_prev__1.png, d_prev.json, work/crop1.png |
| V14 | P3 | /anticipi | 1440 | «Altre operazioni» è un pannello apribile senza freccia: sembra una scheda vuota | d_anticipi__1.png |
| V15 | P3 | grafici | tutte | Entrate di colore diverso in Dashboard; etichetta ciambella 9,2 px; assi 9,8 px; in /analisi stesse tinte per progetti e voci affiancate; in /cambi il giallo indica «applicato»; barre gialla e verde non spiegate in «Media 2026» | d_home.json, d_analisi__2.png, d_cambi__1.png |
| V16 | P3 | sistema | 1440 | 8 altezze di pulsante, 3 di segmenti, campi 40/41/54; intestazioni senza icona («Archivio su Google Drive», «Notule»); «+ Emetti» testuale | agg.py, d_impost__1.png, d_docnuovo__1.png, d_docem__1.png |
| V17 | P3 | /nuovo | 768, 1440 | «Come è stata pagata»: etichette a capo in modo disuguale | t_nuovo__1.png, d_nuovo__1.png |
| V18 | P3 | /admin/impostazioni | 375 | Selettore sì/no impilato in verticale | m_impost__1.png |
| V19 | P3 | tabelle in scheda | tutte | Testo delle celle a 12 px dal bordo, titolo del pannello a 18 px: 6 px fuori asse | d_conti__1.png, d_impost__1.png |
| V20 | P3 | KPI | tutte | Decimali incoerenti (217,71 € in Anticipi, 218 € in Conti); schede con vuoti (/analisi, /finanziamenti a zero); /rendiconto a 375 con 3 KPI impilati invece della griglia 2×2 | d_anticipi__1.png, d_conti__1.png, d_finanz__1.png, m_rendiconto__1.png |
| V21 | P3 | /movimenti, /preventivo | 375 | Segnaposto della ricerca tagliato; riga dati che finisce con «·» isolato | m_movimenti__1.png, __2.png |
| V22 | P3 | barra laterale (francese) | 768 | «Tableau de bord» su due righe | ft_home__1.png |
| V23 | P3 | dettagli | tutte | Stati vuoti di solo testo («Nessun dato.», «Nessuna scadenza aperta.») | d_movdet__1.png, d_progdet__2.png |
| V24 | P3 | /progetti/<id> | tutte | Due icone davanti al titolo | d_progdet__1.png |

## Non verificato
PWA installata e telefoni veri; tema scuro; stati hover/focus, finestre di dialogo, pannelli filtri aperti, messaggi di errore; stampa e PDF; stato vuoto di /documenti-emessi (c'erano già documenti di altri revisori); contrasto colore (non misurato); formato data dei campi (browser di prova in inglese). Parole spezzate: lo script ha segnalato candidati in /guida, /anticipi, /preventivo ma nelle schermate non ne ho trovata nessuna: nessun caso confermato. Un «Pagina non trovata» su /documenti-emessi durante un riavvio del server non si è ripetuto. I totali diversi tra schermate (es. uscite 173.334/173.341/173.349 €) coincidono con dati inseriti dagli altri revisori: non valutati.
