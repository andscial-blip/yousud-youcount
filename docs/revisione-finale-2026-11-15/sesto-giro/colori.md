# YouCount: revisione dei colori (palette, semantica, coerenza)

Metodo: Playwright, colori calcolati (SVG, barre, pastiglie, legende, icone) su circa 25 pagine. Ruoli super_admin (IT) e admin_fr (FR), a 1440 e 375 px. /progetti, /analisi e /conti caricate 6 volte. Prove in `/tmp/yc-final/work/colori/`: dati `*.json`, `cmp.mjs`, `cvd.py` (ΔE2000 e simulazione delle discromie).

## Risposta secca
**Sì nella sostanza.** La palette è quella voluta e i colori di gruppi, progetti, conti e paesi restano identici fra pagine, lingue, larghezze e caricamenti (verificato).
Le eccezioni sono tre:
- un progetto ha due colori: l'icona segue il tipo di progetto, i grafici l'ordine di creazione;
- il giallo ha troppi significati;
- su /analisi lo stesso colore ha due significati diversi in due grafici affiancati.

## Regola dichiarata: verifica

| Regola | Esito | Prova |
|---|---|---|
| Entrate blu notte #2E3D52, uscite giallo #E8BE5A, saldo/avanzo verde acqua #5FB8A3 | Rispettata | Ovunque: card, istogrammi, legende (it1440 `/`, itA `/analisi`, itB `/movimenti`) |
| Blu #5B8FD6 = previsto e tasso del mese | Parziale | Blu in /progetti «Previsto e speso», /analisi Andamento, /cambi, finanziamenti. Nel progetto singolo e in /analisi?vista=budget il previsto è una traccia grigia #E3EAF4 |
| Corallo solo per sforamenti e ritardi | Quasi | Rispettata in barre, anelli e pastiglie. Eccezioni: «Nessun backup scaricato» e i saldi mensili negativi in /report (#B23B32) |
| Italia cielo #8FAFD6, Madagascar lilla #A596E6, conti in sfumature | Rispettata | Italia: #8FAFD6, #B5CBE6, #7393BC, #D3E0F1. Madagascar: #8C80C9, #7C72B0. Uguali in 4 caricamenti IT/FR |
| Gruppi 01–09 nell'ordine oliva … oliva chiaro | Rispettata | 01 #B9C47A · 02 #E3A6C2 · 03 #5B6F8C · 04 #C9D6EA · 05 #9C8AA5 · 06 #A8C3A1 · 08 #7FA5A8 · 09 #D6DCA9, identici su 3 progetti, /preventivo e /analisi, in IT e FR |
| Progetti: colore fisso per ordine di creazione | Grafici sì, icone no | Nei grafici i colori restano stabili anche dopo che un altro revisore ha creato «Agricoltura». Le icone e le card seguono il tipo (vedi D1) |
| «Altri» grigio chiaro | Rispettata | #E3E8EF |
| Registro: entrata blu notte, uscita giallo | Parziale | Uscita giallo ✓. La pastiglia «Entrata» ha fondo #E3EAF4, lo stesso di «Bozza», «automatica» e «creazione» (D4) |
| Importanza scadenze | Rispettata | Critica #E2917F, alta #9C8AA5, normale #8497B0, promemoria #C9D6EA, fatta #A8C3A1 (legenda di /scadenze) |

## Voti

| Area | Voto | Cosa funziona | Cosa manca per il 10 |
|---|---|---|---|
| Aderenza alla palette | **8** | Pastelli piatti su fondo chiaro #F3F5F8, blu notte come àncora, niente marrone vero | Il rosso mattone #B23B32 nelle strisce di avviso andrebbe ammorbidito verso il corallo. Nel blu del previsto #5B8FD6 conviene ridurre la saturazione. Le sfumature malgasce #7C72B0 vanno schiarite verso il lilla. L'icona oliva scuro #56632A tende al kaki |
| Coerenza semantica | **7** | Il cuore (entrate, uscite, saldo, previsto, paesi, importanza) è corretto ovunque | Il giallo va riservato alle uscite e serve un altro colore per «Da verificare», «Oggi», DEMO e «vicino al limite» (D2). «Entrata» va colorata in blu notte (D4). Il giroconto non deve essere lilla (D5). Il corallo va tolto da backup e saldi mensili (D6, D7) |
| Coerenza fra pagine e lingue | **8,5** | Colori identici fra IT e FR, fra 375 e 1440 px e fra ricariche (`reload.mjs`) | Un solo colore per progetto, icona inclusa (D1). Lo stesso schema per i progetti sulla Dashboard e per i gruppi nel Riepilogo (D8) |
| Accessibilità del colore | **7** | Tutti i testi colorati sono AA (da 4,9:1 a 14,5:1). I valori sono quasi sempre scritti accanto al colore | Cielo e lilla con deuteranopia: ΔE 6,2. Corallo critico e salvia «fatta» con deuteranopia: ΔE 7,7. Nebbia e «Altri»: ΔE 6,9. I due conti malgasci: ΔE 6,1. Le barre pastello su bianco stanno sotto 3:1 (giallo 1,76; nebbia 1,47). Servono bordi o separatori e marcatori di forma |
| Armonia complessiva | **8,5** | L'aspetto è calmo e ordinato, con legende e allineamenti curati | Nella ciambella dei progetti tre verdi oliva sono affiancati (#D6DCA9, #A8C3A1, #B9C47A). L'ardesia #5B6F8C pesa fra i pastelli. Le strisce rosse del riquadro «Da fare» sono troppo forti |

## Difetti

| # | Grav. | Pagina · larghezza | Colore | Problema e prova |
|---|---|---|---|---|
| D1 | P2 | /progetti, progetto singolo, /admin/progetti · 375/1440 | icona #47664A, card #EAF1E8 contro grafico #E3A6C2/#B9C47A | L'icona colora il tipo e non il progetto. Le 4 scuole hanno la stessa icona verde, ma nei grafici sono salvia, rosa, oliva e petrolio. Sport e Agricoltura condividono #56632A. L'icona rosa scuro #94416A di StreetFood si confonde con il rosa di Ambohitsiroa. Prova: `it1440_progetti.png`, output di `cmp.mjs` |
| D2 | P2 | /movimenti, /verifica · 1440 | #F6E6C0, #FFF3D3 | Nella stessa riga ci sono tre gialli con tre significati: tessera uscita, «Da verificare», DEMO. Prova: `crop_mov.png` |
| D3 | P2 | /analisi · 1440/375 (IT/FR) | #A8C3A1, #7FA5A8, #D6DCA9 | Nelle due ciambelle affiancate lo stesso colore vuol dire due cose: Antanetibe ed E1, Bonne Semence ed E3, Spese generali ed E4. Prova: `itA_analisi.png` |
| D4 | P3 | /movimenti, /verifica, movimento | #E3EAF4 / testo #1E2B3C | La pastiglia «Entrata» ha lo stesso fondo delle pastiglie neutre, quindi non si riconosce come blu notte |
| D5 | P3 | /movimenti, /verifica | #EEEBFA / #5A4EA6 | Il giroconto è lilla, cioè il colore del Madagascar |
| D6 | P3 | Dashboard «Da fare» · 1440/375 | striscia #B23B32 | «Nessun backup scaricato» è segnato come allarme corallo pur non essendo né sforamento né ritardo. La striscia è rosso mattone, più saturo del corallo. Prova: pixel campionati su `it1440_.png` |
| D7 | P3 | /report | testo #B23B32 | I saldi mensili negativi sono in rosso, ma non sono sforamenti |
| D8 | P3 | Dashboard, /preventivo/riepilogo | #E8BE5A | I progetti (Dashboard) e i gruppi (Riepilogo) sono tutti gialli, mentre altrove hanno il loro colore |
| D9 | P3 | /conti · 1440/375 | #8C80C9/#7C72B0, #D3E0F1 | Le sfumature dei conti non hanno legenda. I due conti malgasci sono poco distinguibili (ΔE 6,1). Il segmento #D3E0F1 sulla traccia #F2F5F9 ha contrasto 1,22 |
| D10 | P3 | /scadenze, calendario | tinte #E2917F / #A8C3A1 | Con deuteranopia «critica» e «fatta» si distinguono solo per una tinta molto chiara (ΔE 7,7). Rischio, non verificato con un utente |
| D11 | P3 | /analisi?vista=budget, progetto singolo | #E3EAF4 contro #5B8FD6 | Il previsto è una traccia grigia qui e una barra blu altrove |
| D12 | P3 | /analisi?vista=budget, /scadenze, /anticipi | #FFF3D3 | Il giallo usato per «attenzione» («vicino al limite», «Oggi», «da seguire») si sovrappone a quello delle uscite |
| D13 | P3 | progetto, /preventivo | #C9D6EA contro #E3E8EF | Il gruppo 04 (nebbia) e «Altri» sono quasi uguali (ΔE 6,9) |
| D14 | P3 | Intestazione | #00A060, #E85828… | Il logo è saturo: è un'impressione, perché probabilmente è il marchio ufficiale e va lasciato |

Accettabili fuori dalla regola: il rosso di «Elimina» e il verde #23735F di «Verificato».
