# YouCount · revisione visiva finale (direzione artistica e UI)

Revisore indipendente, 15/11/2026. Solo ciò che si vede: nessuna lettura di codice né di giri precedenti.

**Copertura (verificato).** Italiano, super_admin: 27 pagine a 375 e a 1440 (/altro solo 375); 17 pagine a 768 (/nuovo a 768 non riuscita: browser caduto). Francese, admin_fr, 375: /, /conti, /preventivo, /analisi. /login alle tre larghezze, anche con errore.
**Prove.** Schermate in `/tmp/yc-final/work/vis/`: `m375_*`, `m375b_*`, `d1440_*`, `d1440b_*`, `t768_*`, `t768b_*`, `fr375_*`, `login_*`; `mm_*` e `mf_*` = riquadri affiancati; `crop_*` = ingrandimenti. Misure automatiche (corpi, raggi, ombre, testo degli assi, troncamenti, scorrimento) in `*_metrics_*.json`.

## Esito in breve
App ordinata e credibile: a 1440 sembra un prodotto finito. Misurato alle tre larghezze: nessuno scorrimento orizzontale di pagina, nessun corsivo, nessun marrone, nulla fuori schermo. Tre cose la tengono lontana dal 10: grafici che non rispettano fino in fondo la regola cromatica; testi troncati con «…» anche dove lo spazio c'è; troppe varianti di corpi, raggi e pulsanti.

## Voti

| Area | Voto |
|---|---|
| Identità e direzione artistica | 8 |
| Design system | 7 |
| UI | 7,5 |
| Grafici | 6,5 |
| Versione desktop | 8 |
| Versione tablet | 7 |
| Versione mobile | 7,5 |
| Coerenza visiva complessiva | 7,5 |
| Professionalità percepita | 8 |

## Giudizio per area

**Identità e DA · 8.** Funziona: blu notte per barra laterale e pulsanti primari, fondo grigio-azzurro chiarissimo, pastelli misurati (giallo, verde acqua, lilla, rosa, salmone); tono calmo adatto a una ONG. Non funziona: il logo a mosaico saturo e il verde vivo di «YOU» sono l'unico elemento ad alta saturazione (`login_1440`, intestazioni); il marchio ha tre composizioni (una riga a 1440, due righe a 375, sola icona a 768); un blu vivo `rgb(91,143,214)` e un verde oliva entrano come colori in più. Per il 10: versione attenuata del marchio dentro l'app; una sola tinta di blu notte (oggi `46,61,82` e `30,43,60` convivono).

**Design system · 7.** Funziona: una sola famiglia (IBM Plex Sans + Condensed), due sole ombre, schede, pillole e campi riconoscibili ovunque. Non funziona (misurato): 22 corpi diversi tra 11 e 32 px, con mezzi punti e valori spuri (11,67 · 16,38 · 22,4); raggi 3-4-5-6-7-8-9-10-12-14-16 px; pulsanti alti 30/32/34/38/40/42/44/46/56 px a 1440; intestazioni di scheda con icona o senza nella stessa pagina (`d1440_docnuovo__1`, `mm_imp`); icone a tratto mescolate a glifi Unicode pieni (barra delle Note in `d1440_home__2`; matita «✎» in `mm_scad`); icona «€» accanto a «Cambia password» (`d1440_pwd__1`); selettore file nativo in inglese «Choose File / No file chosen» (`mm_imp`). Per il 10: scala di 7-8 corpi, 3 raggi, 3 altezze di pulsante; una regola unica per le icone di sezione.

**UI · 7,5.** Funziona: gerarchia chiara, riquadri riassuntivi allineati 4×1 / 2×2, tabelle con cifre a destra, stati vuoti presenti (`d1440_anticipi__1`, `t768_fin__1`). Non funziona: troncamenti con «…» (elenco sotto); «Correggi questo movimento…» fuori da ogni scheda e riga «Storna» diversa dalle altre (`d1440_mov__1`); righe della tabella del preventivo con filetto sfalsato tra metà sinistra e destra (`crop_prev`); «Altre operazioni» sembra una scheda vuota (`d1440_anticipi__1`); larghezze di contenuto diverse in Impostazioni; «Come funziona questa scheda» scende su seconda riga solo in Impostazioni (`d1440_imp__1`).

**Grafici · 6,5.** Funziona: entrate blu notte / uscite gialle / saldo verde rispettati in Dashboard, Analisi, Report, dettaglio progetto; stesso colore per lo stesso progetto in Progetti e Analisi e per lo stesso gruppo di voci in Dashboard, Preventivo e dettaglio progetto; legende con importi. Non funziona: vedi difetti 1, 2, 6, 7, 8. Testo reale degli assi (misurato): 375 → 10,3–11,9 px; 768 → 12,6–13,2 px; 1440 → 10,8–11,3 px (Cambi 9,8–10,3 px); etichetta al centro delle ciambelle 9,2 px ovunque. Per il 10: una sola resa per ogni tipo di grafico, assi ≥ 11 px a tutte le larghezze, scala adattata ai dati.

**Desktop · 8.** La resa migliore: griglie regolari, tabelle leggibili, densità giusta. Restano troncamenti inutili, vuoti grandi in schede affiancate (`d1440_cambi__1`, `d1440_fin__1`), schede-scelta piccole in contenitori larghissimi (`d1440_docnuovo__1`).

**Tablet · 7.** Barra a icone e riquadri 2×2 riusciti; report mensile e rendiconto ottimi (`t768_report__2`, `t768b_rend__2`). Ma Cambi e Preventivo/consuntivo ricadono nella forma impilata da telefono (difetto 5).

**Mobile · 7,5.** Barra inferiore chiara, campi grandi, elenchi leggibili, nessuna parola spezzata a metà. Pesano il report mensile (difetto 4), i troncamenti e pagine molto lunghe (Analisi preventivo 8.363 px).

**Coerenza · 7,5.** Stessa struttura ovunque; la rompono le due rese dello stesso grafico e le varianti di componenti.

**Professionalità · 8.** Un finanziatore la prenderebbe sul serio; la abbassano i «…» sui nomi e i colori incoerenti nel confronto preventivo/consuntivo.

## Difetti

| # | Grav. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| 1 | P1 | /analisi?vista=budget · tutte | Stessa grandezza (speso sul preventivo), due codici colore nella stessa pagina: tabella per gruppo con barre gialle e sforamento salmone; tabella per codice con barre blu acciaio e sforamento rosso scuro. Viola «giallo = uscite» | `d1440_analisib__1`, `__2`; `mm_analisib` |
| 2 | P2 | / contro /analisi, /report · tutte | Stesso grafico entrate/uscite in due rese: in Dashboard pallini del saldo negativo rossi (assenti in legenda) e blu più chiaro; in Analisi e Report pallini tutti verdi e blu più scuro | `crop_homechart`, `d1440_analisi__1` |
| 3 | P2 | /finanziamenti, /preventivo, /conti, /cambi, /analisi · tutte | Testi troncati con «…». A 1440 con spazio libero accanto: «Bando Fondazione per l'istruzione pri…» (intero a 768), «05 · Investimenti e beni durev…», «contanti in mano alle …», «tasso i…». A 375: «BNI Madagasc…», «Fanomezant…», «E1 · Donazioni e …», «entrate meno us…», segnaposto di ricerca tagliati | `d1440_fin__1`, `t768_fin__1`, `d1440_prev__1`, `d1440_conti__1`, `mm_conti`, `mm_prev`, `mm_analisi` |
| 4 | P2 | /report · 375 | Tabella mensile resa come griglia 3+2: «Entrate Madagascar» va a capo e sfalsa le etichette, una cella resta vuota, colonne non allineate tra le righe; pulsanti del selettore di larghezze diverse su due colonne | `mm_report` |
| 5 | P2 | /cambi, /analisi?vista=budget · 768 | Tabelle impilate «etichetta / valore» con metà larghezza vuota; in Cambi il valore «5.279 MGA» è rientrato rispetto agli altri | `t768_cambi__2`, `t768_analisib__2` |
| 6 | P2 | /conti, /cambi, /movimenti, /progetti, /riconciliazione · tutte | Colori «semantici» usati con altro significato: barra dei conti Italia in blu notte/verde/giallo/lilla; mini-barre «Media 2026» blu vivo con minimo verde e massimo giallo; «da spuntare» tutto giallo; «Previsto» blu vivo in Progetti ma «Ricevuto» blu notte in Finanziamenti | `d1440_conti__1`, `d1440_cambi__1`, `d1440_riconc__1`, `d1440_prog__1`, `d1440_fin__1` |
| 7 | P2 | /, /analisi (francese) · 375 | Mesi sull'asse «Jui Jui» (juin e juillet indistinguibili); altri troncamenti: «E2 · Subventions pour proj…», «dépenses couver…», «recettes moins d…» | `mf_analisi`, `mf_prev` |
| 8 | P3 | /analisi, /report, dettaglio progetto · tutte | Scala fissa ±50k con dati tra −22k e +42k (nel progetto ancora meno): metà inferiore vuota | `d1440_report__1`, `d1440b_progdet__1` |
| 9 | P2 | dettaglio movimento · 768 | Su una bozza di prova in ariary: «−13 MGA» grande e sotto «0» senza simbolo. Contrario a «euro grande, ariary piccolo». Visto su un solo movimento | `t768_mov__1` |
| 10 | P3 | /documenti-emessi/<id> · 375 | Anteprima: intestazione «Prezzo / Pri» e importo «180,00 €» tagliati (scorre dentro il riquadro, senza indizio); azioni doppie (barra fissa e scheda «Azioni») | `mm_docdet` |
| 11 | P3 | /scadenze · 375 | Filtro «90…» tagliato dal pulsante accanto; titoli a capo in colonna stretta con spazio libero a destra | `mm_scad` |
| 12 | P3 | varie | Rifiniture: interruttore sì/no impilato e «Salva» di larghezze diverse (/admin/impostazioni 375); «DEMO-2026-1011» spezzato su due righe (/movimenti 1440); «Differenza da spuntare» a capo in punti diversi (/riconciliazione); «Di tasca propria» su due righe (/nuovo 1440); anello decorativo solo nell'ultimo riquadro (/preventivo, /analisi) | `mm_imp`, `d1440_movimenti__1`, `d1440_riconc__1`, `d1440_nuovo__1`, `d1440_prev__1` |

Nessun P0 visivo.

## Cosa impedisce il 10 (in ordine di effetto)
1. Una sola resa per preventivo/consuntivo e per entrate/uscite; un solo rosso.
2. Togliere i «…» (testo a capo o colonne più larghe).
3. Ridurre corpi, raggi, altezze dei pulsanti; regola unica per le icone.
4. Tabelle vere a 768; report mensile a 375 ridisegnato.
5. Colori neutri per le composizioni; assi ≥ 11 px; scala sui dati; mesi francesi distinti.

## Non verificato
- PWA installata e telefoni veri.
- Campi data: qui appaiono «mm/dd/yyyy» e «11/15/2026» perché il browser di prova è in inglese; resa su dispositivi italiani o francesi non verificata.
- /nuovo a 768; stati al passaggio del mouse e di fuoco; finestre di dialogo, pannelli Filtri, menu aperti; errori dei moduli (tranne /login).
- PDF e stampe; tema scuro; schermata iniziale; pagine non richieste (/verifica, /rimborsi, /controparti, /chiedi, /documenti, altre di /admin); ruoli responsabile e operatore; francese oltre le 4 pagine a 375.
- Contrasti cromatici non misurati. Le misure contano 37 testi nel blu standard dei collegamenti (`rgb(0,0,238)`) che non ho individuato nelle schermate.
