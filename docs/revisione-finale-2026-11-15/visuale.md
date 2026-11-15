# YouCount — revisione visiva finale (direzione artistica e UI)

Revisore indipendente · 15/11/2026 · copia locale :3313 · ruolo super_admin, italiano.
Coperto: 26 pagine a 1440 e a 375 (/altro solo 375), 16 pagine a 768. Circa 150 schermate.
Prove in /tmp/yc-final/work: `v<larghezza>_<pagina>__N.png` (riquadri singoli), `m375_*.png` e `m768_*.png` (riquadri affiancati), `crop_*.png` (ingrandimenti). Misure: vbatch.mjs, vprobe.mjs, vmetrics_*.jsonl.
«Verificato» = visto in schermata o misurato. «Impressione» = giudizio.

## Sintesi
Prodotto visivamente maturo e riconoscibile: blu notte, fondo chiaro, pastelli, IBM Plex Sans + Condensed, nessun corsivo, nessuno scorrimento orizzontale di pagina a nessuna larghezza (misurato su tutte le pagine), nessuna parola spezzata a metà (verificato sulle schermate viste). Non è da 10 per quattro motivi: i colori dei grafici non hanno un solo significato; alcune tabelle e file di pulsanti sono fuori asse; tre barre scorrevoli sono tagliate senza indizio; il sistema ha troppe eccezioni (altezze dei pulsanti, due misure di pillola, schede con e senza icona).

## Voti

| Area | Voto | Funziona | Non funziona | Cosa impedisce il 10 |
|---|---|---|---|---|
| Identità e direzione artistica | 8 | Palette tenue coerente con «blu notte e pastelli»; login pulito; tono sobrio da strumento finanziario | Il logo YouSud saturo stacca dalla palette (impressione); testo di avviso e icona attiva «Altro» in ocra scuro rgb(138,97,0), vicino al marrone | Un ocra più giallo; verde del marchio «YOU» e verde saldo armonizzati |
| Design system | 7 | Schede, KPI, schede di navigazione, pillole di stato e campi sono riconoscibili ovunque | Pulsanti alti 28/30/32/34/38/40/42/44/46 px (misurato); pillole a 13 px e 11 px nella stessa riga; schede con e senza icona nel titolo; icone a glifo (☐ ★ ⚑ ☎ ✎) accanto a icone a linea; «+ Emetti» con «+» di testo | Tre altezze di pulsante, una regola per le icone di scheda, un solo set di icone |
| UI | 7,5 | Gerarchia chiara, importi allineati a destra, KPI in griglia regolare, stati vuoti presenti | /admin/utenti fuori asse; schede chiuse senza indizio («Storna», «Altre operazioni»); KPI in MGA grande con euro piccolo in /conti e /anticipi | Allineamenti di tabella, indizi di apertura, euro sempre grande |
| Grafici | 7 | Entrate blu notte, uscite giallo, saldo verde nei grafici mensili; gruppi di spesa con lo stesso colore tra Dashboard, Preventivo e dettaglio progetto; progetti uguali tra Progetti e Analisi | Vedi D1 e D4 | Una tabella colori unica e scale adattate ai dati |
| Desktop 1440 | 7,5 | Densità giusta, tabelle leggibili, due colonne equilibrate | D2, D5; Impostazioni a colonna stretta mentre Utenti è a tutta larghezza; pillola «Come funziona» su seconda riga solo in Impostazioni | Correzioni puntuali |
| Tablet 768 | 7 | Barra laterale a icone, KPI 2×2, grafici ben proporzionati | Le tabelle diventano schede da telefono: /analisi?vista=budget alta 7.847 px, /cambi 3.963 px; colonne mal ripartite (D7, D8) | Tabelle vere a 768 |
| Mobile 375 | 7,5 | Barra in basso con «+» centrale, moduli comodi, nessuna fuoriuscita | D3, D5, D6; etichette degli assi circa 8 px (stima da schermata) | Importi MGA su due righe, barre scorrevoli con sfumatura |
| Coerenza visiva complessiva | 7,5 | Stessa intestazione, stesse schede, stesso lessico cromatico di base | Il confronto preventivo/speso cambia colore tra desktop e tablet/telefono; «Stampa / PDF» e «Stampa o PDF» | Un colore per concetto, ovunque |
| Professionalità percepita | 8 | Si presenta come prodotto finito, credibile davanti a un revisore o a un finanziatore | I difetti P1–P2 qui sotto si notano proprio nelle pagine con i numeri | Chiudere D1–D5 |

## Difetti (tutti verificati salvo indicazione)

| # | Gravità | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| D1 | P1 | grafici · tutte | Un colore, più significati. Blu notte (entrate) usato anche per «Uscite per progetto» in Dashboard, per «Italia» in Liquidità, per il gruppo «Sede e funzionamento» e per «Spese generali» nella barra KPI di Progetti (che nella ciambella subito sotto è azzurro). Speso su preventivo: blu acciaio e rosso pieno a 1440, giallo e corallo a 768/375 e nel dettaglio progetto. «Previsto» in un terzo blu. Lilla e rosa valgono per gruppi di spesa, progetti e voci di entrata | v1440_dash__2, v1440_progetti__1, v1440_budget__2, m768_budget, v1440_prjdet__2, v1440_prev__1 |
| D2 | P2 | /admin/utenti · 1440 | Intestazioni «Ruolo» e «Stato» non in asse con le celle; la riga dell'utente corrente è spostata rispetto alle altre | v1440_utenti__1 |
| D3 | P1 | /conti · 375 | Conti in MGA: «Entrate» e «Uscite» si toccano («526.958.397 MGA505.193.400 MGA») e sforano il margine destro | crop_conti_mg, m375_conti |
| D4 | P2 | /analisi, /report · 1440 e 375 | Grafico mensile scalato come immagine: etichette degli assi alte 22 px a 1440 (testo 14 px), circa 8 px a 375. Scala fissa ±50k: metà inferiore quasi vuota | v1440_analisi__1, v1440_report__1, m375_analisi, vprobe |
| D5 | P2 | /report 1440 e 768 · /scadenze 375 · dettaglio documento 375 | Barre scorrevoli tagliate senza indizio: schede report (1.339 px in 1.138 e in 634), filtri scadenze («90» coperto), tabella dell'anteprima documento (440 px in 305: colonna Importo nascosta) | v1440_report__1, m768_report, m375_scad, m375_docdet |
| D6 | P2 | /preventivo 375 · /admin/impostazioni 375 · /documenti-emessi 375 | Pulsanti di larghezza diversa nella stessa fila («Apri la bozza» / «Versioni · 2») o nello stesso modulo («Salva» stretto, «Salva il logo» pieno); «+ Emetti» stretto dove altrove il primario è pieno | m375_prev, m375_impost, m375_docem |
| D7 | P2 | dettaglio progetto · 768 | Tabella «Preventivo e consuntivo»: colonna Gruppo compressa, nomi su tre righe, la barra occupa lo spazio | m768_prjdet |
| D8 | P2 | /progetti · 768 | «Previsto e speso»: importi fermi a metà scheda, non allineati al bordo destro | m768_progetti |
| D9 | P2 | /conti, /anticipi · tutte | KPI con ariary grande ed euro piccolo (contrario alla regola del committente); a 375 i valori MGA hanno corpo minore dei vicini e le etichette sono troncate («BNI Madagasc…») | v1440_conti__1, m375_conti |
| D10 | P2 | tablet 768 | Tabelle convertite in schede: pagine molto lunghe | vmetrics_768.jsonl, m768_cambi, m768_budget |
| D11 | P3 | varie | Schede con e senza icona nel titolo (Impostazioni, nuovo documento, Utenti); icona «€» su «Cambia password»; pillola «Come funziona» a sinistra solo in Guida | v1440_impost__1, v1440_docnuovo__1, v1440_pwd__1, v1440_guida__1 |
| D12 | P3 | /riconciliazione 1440 · /preventivo 1440 | Pulsanti «Riconcilia» a quote diverse tra schede vicine; filetti delle righe sfalsati di 1 px a metà tabella | v1440_riconc__1, v1440_prev__2 |
| D13 | P3 | /analisi · tutte | KPI Entrate e Uscite senza righe di nota, le altre due sì: fila asimmetrica; «entrate meno us…» troncato a 375 | v1440_analisi__1, m375_analisi |
| D14 | P3 | /report · 375 | Mesi in griglia 3+2 con etichette a destra: lettura irregolare; schede report disposte a nuvola | m375_report |
| D15 | P3 | barra in basso · 375 | Icona attiva di «Altro» in ocra rgb(138,97,0); «Conti» attivo è blu notte | crop_nav_prev, vprobe |
| D16 | P3 | dettaglio movimento · 375 | Vuoto ampio tra scheda «Elimina» e «Correggi questo movimento…» | m375_movdet |

## Interventi in ordine di effetto
1. Tabella colori unica per i grafici (entrate, uscite, saldo, previsto, sforamento, gruppi, progetti) applicata a ogni larghezza.
2. /conti 375: importi MGA su righe separate o senza sigla ripetuta.
3. Grafici mensili: testo a dimensione fissa, scala calcolata sui dati.
4. Sfumatura o freccia su ogni barra scorrevole.
5. Allineare /admin/utenti; tabelle vere a 768.
6. Ridurre le altezze dei pulsanti a tre; una misura di pillola per riga; icone di scheda sempre o mai.

## Non verificato
- PWA installata, telefoni e tablet veri, schermata di avvio.
- Versione francese e ruoli diversi da super_admin.
- Stati al passaggio del mouse, fuoco da tastiera, finestre di dialogo, filtri aperti, errori dei moduli, PDF e stampa.
- Campi data e file nativi: nel browser di prova appaiono in formato inglese («mm/dd/yyyy», «Choose File»); dipende dalla lingua del browser.
- Pagine fuori elenco (/verifica, /rimborsi, /controparti, /finanziamenti, /chiedi, altre schede di Impostazioni); moduli a 768.
- Durante la prova i dati cambiavano (altri revisori): i totali nelle schermate differiscono tra larghezze; non valutato.
