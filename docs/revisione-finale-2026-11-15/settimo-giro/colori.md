# YouCount: colori e visualizzazione dati (revisore indipendente)

19/11/2026 · ruoli super_admin, admin_fr, responsabile, operatore · 375/768/1440. Schermate in `/tmp/yc-final/work/`. Colori misurati dal browser (`swatch.mjs`, `icons.mjs`, `badges.mjs`); ΔE CIELAB anche con deuteranopia e protanopia simulate.

Palette osservata (verificato): blu notte 46,61,82 = **entrate**; giallo ocra tenue 232,190,90 = **uscite/speso**; verde acqua 95,184,163 = **saldo/avanzo**; salmone 226,145,127 = **oltre il preventivo / ritardo**; azzurro 143,175,214 = **Italia**; lilla 165,150,230 = **Madagascar**; blu 91,143,214 = **previsto** (solo in Progetti).

## 1. Scelta delle tinte: 8,5
**Funziona.** Fondo chiaro, blu notte come colore principale, pastelli verde acqua, lilla, giallo e verde. Niente marrone, niente colori accesi (`sa_home__1.png`, `sa_progetti__1.png`).
**Cosa impedisce il 10.**
- Il blu del «previsto» (91,143,214) è il colore più saturo dell'app e stona accanto ai pastelli (`sa_progetti__1.png`, «Previsto e speso»).
- Il viola scuro dei conti malgasci (110,98,168) è più pesante del lilla del paese (`sa_conti__1.png`).
- Tre verdi dei progetti sono quasi uguali: Ambohitsiroa, Piccolino e StreetFood (ΔE 15) (`sa_progetti__1.png`, ciambella).

## 2. Coerenza semantica: 6,5
**Funziona.**
- Entrate in blu notte, uscite in giallo e saldo in verde acqua sono identici in Dashboard, Movimenti, Progetti, Analisi, Report e Preventivo, in IT e FR.
- Lo sforamento è salmone ovunque: barre del preventivo, anello, Analisi budget.
- Italia azzurro e Madagascar lilla vanno d'accordo tra Liquidità, chip IT/MG e Conti.
- I gruppi di **entrata** (E1-E4) sono in scala di blu notte e grigi, quindi distinti dai progetti (`sa_analisi__2.png`).
- Ogni progetto ha lo stesso colore in Dashboard, Progetti, Analisi e icona (riquadro tinto, identico in /progetti e /admin/progetti; `icons.mjs`).

**Non funziona.**
- **I gruppi di spesa usano esattamente i colori dei progetti** (verificato in RGB): Investimenti = École Antanetibe (156,138,165); Risorse umane = École Piccolino (185,196,122); Viaggi = Bonne Semence (227,166,194); Sede = StreetFood (168,195,161); Attività di progetto = Spese generali (91,111,140). Sulla stessa Dashboard i due grafici stanno a pochi centimetri (`sa_home__1.png` «Dove vanno le spese», `sa_home__2.png` «Uscite per progetto»). Il caso peggiore è la scheda di École Piccolino: «01 · Risorse umane» compare nel colore del progetto stesso (`sa_progetti_08223491…__1.png`).
- **Il «previsto» non ha un colore stabile.**
  - È blu in Progetti, «Previsto e speso».
  - È giallo (il colore delle uscite) in Preventivo, scheda «Uscite previste» (`sa_preventivo__1.png`).
  - È una traccia azzurrina in Analisi budget e una tacca in Dashboard.
  - Lo stesso blu in Cambi significa «tasso del mese» (`sa_cambi__1.png`).
- **Il rosa-salmone chiaro ha troppi significati.** Sfondo 251,231,224 per «Da verificare» (stato normale, 40 movimenti), «In attesa di rimborso», «Da rimborsare», «Oggi», «Scaduta da 19 g» e «oltre il preventivo» (`sa_movimenti__1.png`, `sa_scadenze__2.png`, `op_home__1.png`). L'operatore vede le sue spese «Da verificare» come se fossero errori.
- Nel «Da fare» tutte le icone sono su cerchio rosa, anche le voci ordinarie. Solo il bordo sinistro (salmone o blu) distingue l'urgenza (`crop_op_dafare.png`).
- **Il colore del Madagascar cambia.** Nella barra Liquidità è il lilla 165,150,230. Nella scheda Madagascar e nelle righe dei conti è il viola 110,98,168 / 140,128,201. Il lilla del paese è usato anche per «Anticipi aperti/in corso» (`sa_conti__1.png`, `sa_anticipi__1.png`). Per l'Italia invece il primo conto coincide col colore del paese.
- Due progetti hanno lo stesso colore: École Anjazafohy = École Piccolino, riquadro identico (`sa_admin_progetti__1.png`, `icons.mjs`).
- Il giallo vuol dire «uscite», ma nella legenda Anticipi vuol dire anche «da seguire» (`sa_anticipi__1.png`).

## 3. Coerenza tra pagine, ruoli e lingue: 8,5
**Funziona.** Colori identici in FR (`fr_home__1.png`, `fr_movimenti__1.png`), per operatore (`op_home__1.png`), per responsabile a 768 (`t_sheet.png`) e a 375 (`m_sheet.png`). Le tessere Entrata (blu notte ↙), Uscita (giallo ↗) e Giroconto (grigio-verde ⇄) e il badge DEMO (grigio-azzurro) sono uguali ovunque.
**Cosa impedisce il 10.**
- **Cassa Madagascar (contanti) non ha il quadratino colore** nelle tabelle di Conti, a 1440 e a 375. È anche il conto in negativo (`sa_conti__1.png`, `m_sheet.png`).
- I negativi sono rossi in Conti, Dashboard e Progetti, ma neri nel Report mensile, colonna «Saldo del mese» (`sa_report__2.png`).

## 4. Accessibilità del colore: 7,5
**Funziona.**
- Il contrasto del testo misurato è sempre ≥ 4,9:1. Il minimo è il grigio 100,113,130 su bianco a 12 px; «Verificato» e «oltre 3 mesi» sono 4,92 (`badges.mjs`).
- Gli stati hanno sempre testo e icona (✓ Verificato, ⏱ Da verificare), oltre al colore.
- Lo sforamento è scritto anche a parole («oltre il preventivo», «oltre di 3.334 €»).
- I paesi hanno le chip con la scritta IT/MG. Il calendario ha la legenda (`sa_scadenze__2.png`).

**Cosa impedisce il 10.**
- Con la deuteranopia diversi progetti si confondono: Antanetibe/Sport ΔE 5,1 (13,5 a vista normale); Spese generali/Sport ΔE 15,9. Nelle ciambelle l'unico aiuto è l'ordine della legenda.
- In «Previsto e speso» lo sforamento di Piccolino si vede solo dal colore della barra (salmone contro giallo), senza etichetta (`sa_progetti__1.png`).
- IT/MG con la deuteranopia: ΔE 14,5. Basta, solo perché c'è la scritta.

## 5. Grafici: 7,5
**Funziona.**
- Barre divergenti entrate/uscite con punto del saldo: chiare e identiche in Dashboard, Analisi, Report e progetto.
- Le legende hanno anche i totali. Le ciambelle mostrano i primi 5 più «Altri» in grigio.

**Cosa impedisce il 10.**
- Nessun colore riservato ai gruppi di spesa (vedi area 2).
- Il report «Mensile Italia / Madagascar» non usa l'azzurro e il lilla: il grafico mostra solo entrate e uscite, il paese c'è solo in tabella (`sa_report__1.png`).
- Nella scheda «Media 2026» di Cambi c'è una barra blu notte tra barre azzurre, senza spiegazione (`sa_cambi__1.png`).
- Un progetto cambia colore quando finisce in «Altri»: StreetFood e Sport sono colorati nell'elenco della Dashboard, grigi nelle ciambelle.

**Interventi in ordine di effetto**
1. Dare ai gruppi di spesa una famiglia propria e diversa dai progetti, per esempio toni di giallo e ocra per variazione di chiarezza, come si fa per le entrate con il blu.
2. Creare un colore unico «previsto», per esempio un blu notte chiaro tratteggiato, e usarlo in Progetti, Preventivo, Analisi e Dashboard. Non riusarlo in Cambi.
3. Usare il rosa solo per errori e scadenze. Mettere «Da verificare» e «In attesa di rimborso» in giallo tenue o in neutro.
4. Usare per il Madagascar lo stesso lilla nella barra e nelle righe dei conti, e un colore neutro per gli anticipi. Aggiungere il quadratino a Cassa Madagascar.
5. Rendere più distinti i colori dei progetti (meno verdi simili) e vietare doppioni (Anjazafohy = Piccolino).

## Tabella dei voti

| Area | Voto |
|---|---|
| 1. Scelta delle tinte | 8,5 |
| 2. Coerenza semantica | 6,5 |
| 3. Coerenza tra pagine, ruoli, lingue | 8,5 |
| 4. Accessibilità del colore | 7,5 |
| 5. Grafici | 7,5 |

## Difetti

| # | Gravità | Difetto | Pagina | Larghezza | Prova |
|---|---|---|---|---|---|
| 1 | P2 | I gruppi di spesa hanno gli stessi RGB dei progetti (5 coppie) | /, /preventivo, /progetti/<id> | tutte | `sa_home__1/2.png`, `sa_progetti_08223491…__1.png`, `swatch.mjs` |
| 2 | P2 | Il «previsto» cambia colore (blu, giallo, traccia, tacca); il blu del previsto in Cambi vuol dire «tasso» | /progetti, /preventivo, /analisi?vista=budget, /cambi | 1440 | `sa_progetti__1.png`, `sa_preventivo__1.png`, `sa_cambi__1.png` |
| 3 | P2 | Rosa-salmone per stati normali («Da verificare», «In attesa di rimborso», «Oggi») uguale a scaduto/sforato | /movimenti, /, /scadenze | tutte | `sa_movimenti__1.png`, `op_home__1.png`, `sa_scadenze__2.png` |
| 4 | P2 | Madagascar: lilla nella Liquidità, viola nei conti; lilla anche per gli anticipi | /conti, /anticipi, / | 1440, 375 | `sa_conti__1.png`, `sa_anticipi__1.png` |
| 5 | P3 | Cassa Madagascar (contanti) senza quadratino colore | /conti | 1440, 375 | `sa_conti__1.png`, `m_sheet.png` |
| 6 | P3 | École Anjazafohy e École Piccolino con lo stesso colore | /admin/progetti | 1440 | `sa_admin_progetti__1.png` |
| 7 | P3 | Colori dei progetti poco distinguibili (3 verdi; Antanetibe/Sport ΔE 5 con la deuteranopia) | /progetti, /analisi | tutte | `sa_progetti__1.png`, calcolo ΔE |
| 8 | P3 | Sforamento in «Previsto e speso» indicato solo dal colore | /progetti | 1440, 375 | `sa_progetti__1.png` |
| 9 | P3 | Icone del «Da fare» tutte su rosa, anche le voci ordinarie | / | 1440 | `crop_op_dafare.png`, `sa_home__1.png` |
| 10 | P3 | Negativi non rossi nel Report mensile, rossi altrove | /report | 1440 | `sa_report__2.png` |
| 11 | P3 | Il report «Italia / Madagascar» non usa i colori dei paesi; barra blu notte senza spiegazione in «Media 2026» | /report, /cambi | 1440 | `sa_report__1.png`, `sa_cambi__1.png` |
| 12 | P3 | Giallo = uscite, ma anche «da seguire» nella legenda Anticipi | /anticipi | 1440 | `sa_anticipi__1.png` |

Fuori dalla mia area (solo segnalato): il Report mensile dà Uscite 173.345 € e Saldo 54.749 €, Analisi e Dashboard 173.334 € e 54.760 €. Stesso caricamento, `sa_report__1.png` contro `sa_analisi__1.png`. Va controllato.
