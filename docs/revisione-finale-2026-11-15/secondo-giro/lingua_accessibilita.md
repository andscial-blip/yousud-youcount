# YouCount · revisione finale di testi, francese e accessibilità

Revisore indipendente, 15/11/2026. Prove in `/tmp/yc-final/work/la/`.

## Copertura

| Controllo | Fatto |
|---|---|
| Testo letto in italiano / in francese | 37 / 37 pagine |
| Schermate francesi 375 / 1440 (con ricerca automatica dei testi troncati) | 14 / 13 pagine |
| Aiuto in linea aperto, etichette citate confrontate con la pagina | 15 pagine FR, 12 IT |
| axe-core 4.x (WCAG 2.0-2.2 A/AA + buone pratiche) | 16 pagine a 1440, 14 a 375 |
| Prove manuali | tabulazione e invio vuoto su /nuovo (IT 1440, FR 375), Esc su 3 pannelli, login FR, 404, offline |

## Voti

| Area | Voto |
|---|---|
| Chiarezza dei testi (italiano) | 8,5 |
| Francese | 8 |
| Coerenza terminologica | 7,5 |
| Guida e aiuto in linea | 8 |
| Accessibilità | 8 |

### Chiarezza dei testi (italiano) · 8,5
- Funziona: frasi brevi, conseguenze dette prima del clic, errori concreti («Per registrare mancano: importo, codice contabile»), conferme che ripetono l'oggetto, 404 chiara.
- Non funziona: gergo in Dati e sicurezza («il foglio documents ne elenca percorso e impronta», «nel progetto del codice»); «come nel Gestionale» non spiegato; etichetta «dai dati» in Scadenze.
- Impedisce il 10: togliere il gergo dalle pagine di amministrazione; «dai dati» → «automatica»; spiegare «Gestionale».

### Francese · 8
- Funziona: lingua naturale; lessico contabile corretto (extourne, pièce justificative, comptabiliser, avance, tiers, rapprochement, bailleur); virgolette « » e spazi prima di ; ? ! corretti; login, 404 e offline tradotti.
- Non funziona: vedi difetti 1, 3, 4, 6, 7, 9, 10.
- Impedisce il 10: testi troncati a 375; lang e titolo della 404; due punti e apostrofi; un solo nome per il rendiconto; residui italiani.

### Coerenza terminologica · 7,5
- Funziona: menu, titolo della scheda, linguette e Guida usano gli stessi nomi di sezione; stati costanti in italiano.
- Non funziona: difetti 5, 6, 8; inoltre in francese «Accueil» nella barra in basso ma «Tableau de bord» nel menu, «Déconnexion» / «Se déconnecter», «E-mail» / «Email», association / organisme / organisation per l'ente; in italiano Registro attività / registro modifiche / Storico delle modifiche.
- Impedisce il 10: un glossario unico per pagina, aiuto e Guida (codice/voce/categoria, comptabiliser/enregistrer, rendiconto).

### Guida e aiuto in linea · 8
- Funziona: aiuto su 35 pagine su 37; Guida per compiti (22 voci con «Portami lì →»); le etichette citate esistono (quelle non trovate compaiono dopo un'azione o per un altro ruolo, tranne il difetto 8).
- Non funziona: nessun aiuto su /chiedi e /altro; aiuto di /nuovo con paragrafi in ordine sparso e di /preventivo lungo 4.900 caratteri; frasi da registro delle modifiche («si trova qui e non più nel Registro»).
- Impedisce il 10: aiuti lunghi in passi numerati, le due pagine mancanti, via i riferimenti a versioni precedenti.

### Accessibilità · 8
- Funziona: lang corretto (it/fr); titolo distinto per linguetta; «Vai al contenuto» come primo Tab; fuoco visibile su 44 passi su 46 (gli altri 2 sono il selettore data del browser); ordine di tabulazione logico; invio vuoto: fuoco sul primo campo, aria-invalid, riepilogo role=alert; Esc chiude aiuto, filtri e ricerca; nessun campo senza etichetta.
- Non funziona: difetti 2, 11-15.
- Impedisce il 10: ruoli ARIA del calendario; errori collegati ai campi; comandi a 44 px; contrasto nella barra laterale.

## axe-core: violazioni per pagina (critiche / serie / moderate / minori)

| Pagina | 1440 | 375 |
|---|---|---|
| /login | 0/0/0/0 | 0/0/0/0 |
| / | 0/3/0/0 | 0/2/0/0 |
| /movimenti | 0/2/0/0 | 0/1/0/0 |
| /nuovo | 0/2/0/0 | 0/1/0/0 |
| /movimenti/<id> | 0/2/0/0 | 0/1/0/0 |
| /conti | 0/2/0/0 | 0/1/0/0 |
| /preventivo | 0/2/0/0 | 0/1/0/0 |
| /analisi | 0/3/0/0 | 0/2/0/0 |
| /report | 0/2/0/0 | 0/1/0/0 |
| /documenti-emessi | 0/2/1/0 | 0/1/1/0 |
| /scadenze | 7/5/0/0 | 7/1/0/0 |
| /admin/impostazioni | 0/2/0/0 | 0/1/0/0 |
| /guida | 0/2/1/0 | 0/1/1/0 |
| /altro | – | 0/1/0/0 |
| /rendiconto, /anticipi | 0/2/0/0 | – |
| /offline | 0/0/0/0 | – |

| Regola | Gravità | Elemento | Dove |
|---|---|---|---|
| aria-required-parent | critica ×7 | `.cal-wd[role=columnheader]` (lun…dom) senza riga/griglia | /scadenze |
| color-contrast | seria | `.side-role` «Super amministratore», #9aa1ac su #2e3d52 = 4,23:1 a 12,5 px (serve 4,5) | tutte, 1440 |
| color-contrast | seria | `.wm-you` (logo, aria-hidden, 3,1:1): logotipo, esente, falso positivo | tutte, 375 |
| label-content-name-mismatch | seria | `.searchbtn`, aria-label «Cerca (⌘K)» diverso dal testo visibile | tutte, 1440 |
| nested-interactive | seria | `svg[role=img][tabindex=0]` «Entrate / Uscite» con link interni | /, /analisi |
| target-size | seria ×3 | `.cal-i` (eventi del calendario) | /scadenze 1440 |
| landmark-unique | moderata | più `nav` con la stessa etichetta «Sezioni» | /guida, /documenti-emessi |

Bersagli al tocco a 375: barra in basso e pulsanti primari 44 px. Sotto i 44: Uscita/Entrata/Giroconto 40, «Fatta» 40, sì/no 40, linguette 40, «Mostra» 36, selettore anno 71×34, filtri periodo 32, icone in alto 34×44, caselle 18×18, link nel testo 18-20, segni del calendario 42×6.

## Difetti

| # | Grav. | Difetto | Pagina · larghezza | Prova |
|---|---|---|---|---|
| 1 | P2 | Testi francesi troncati con «…» nei riquadri: «dépenses couver…», «E1 · Dons et coti…», «05 · Investissem…», «dans les dé…», «avec p…», «recettes moins d…»; a 1440 «espèces confiées aux …» | /preventivo, /anticipi, /rimborsi, /analisi 375; /conti 1440 | `admin_fr_375_preventivo__1.png`, `_anticipi`, `_rimborsi`, `admin_fr_1440_conti__1.png` |
| 2 | P2 | Calendario: 7 intestazioni con ruolo ARIA senza contenitore; eventi alti 6 px a 375 | /scadenze | `a11y_375_super_admin.json` |
| 3 | P2 | 404 per utente francese: testo in francese ma `lang="it"` e titolo «YouCount · Contabilità YouSud»; stesso titolo italiano su login e offline in francese | 404, /login, /offline | uscita di `inter.mjs admin_fr`, `login.mjs` |
| 4 | P2 | Francese: manca lo spazio prima dei due punti in almeno 9 punti («Pour comptabiliser il manque: …», «Banque Italie: 78 %», «Octobre: 5 286,62 MGA», «2025: –», «Codes: 999», «Sans pièce justificative: …», «Recettes 2025: …») | /nuovo, /conti, /cambi, /rendiconto, /scadenze, dettaglio | `admin_fr__*.txt` |
| 5 | P2 | Stesso concetto, più nomi: Categorie / piano dei conti / codice contabile / voce (FR catégories / plan comptable / code comptable / poste / groupe de postes / groupe de codes); il campo si chiama «Code comptable» ma il suo segnaposto è «Chercher un poste…» | /nuovo, /admin/piano-conti, aiuti | `admin_fr_1440_nuovo__1.png` |
| 6 | P2 | «Rendiconto per cassa» in francese ha 5 forme: compte rendu financier de caisse, compte rendu de caisse, compte de caisse, Compte ETS, Comptes rendus | /rendiconto, /report, /scadenze, aiuti | `admin_fr__rendiconto.txt`, `__scadenze.txt`, `__rimborsi.help.txt` |
| 7 | P2 | «Comptabilisé» e «enregistré» usati per lo stesso stato («Un mouvement enregistré ne se supprime pas»), mentre «Enregistrer» è anche il comando Salva | aiuto /movimenti, /scadenze | `admin_fr__movimenti.help.txt` |
| 8 | P3 | L'aiuto cita «Con l'anticipo» / « Avec l'avance », il pulsante dice «Anticipo» / «Avance» | /anticipi → /nuovo | `hc_super_admin__anticipi.txt`, `admin_fr__nuovo.txt` |
| 9 | P3 | Residui italiani e traduzioni letterali: «le Gestionale», parola da digitare «AZZERA», badge «des données», «non prévue» (poste è maschile), «Storno MOV-…» nelle descrizioni generate | /rendiconto, /admin/dati, /scadenze, /analisi, /movimenti | testi FR; `admin_fr_375_movimenti__1.png` |
| 10 | P3 | Tipografia francese non uniforme: apostrofi ’ e ' mescolati nella stessa pagina; «77%» nelle tabelle e «75 %» nei riquadri; mesi abbreviati in tre modi, con «Jui» due volte di seguito (giugno e luglio) | /cambi, /analisi, /movimenti | `admin_fr__cambi.txt` |
| 11 | P3 | Errori non collegati ai campi: nessun aria-describedby né aria-required; «Projet» mostra «Champ obligatoire» ma senza aria-invalid | /nuovo | uscita di `inter.mjs` |
| 12 | P3 | Comandi a 40 px o meno a 375 (elenco sopra) | varie · 375 | `a11y_375_super_admin.json` |
| 13 | P3 | Contrasto 4,23:1 del ruolo utente nella barra laterale | tutte · 1440 | axe |
| 14 | P3 | Titolo della scheda non specifico: /nuovo «Movimenti · YouCount», dettaglio «Registro · Movimenti», Preventivo e consuntivo «Grafici · Analisi» | /nuovo, /movimenti/<id>, /analisi?vista=budget | `super_admin__meta*.json` |
| 15 | P3 | Dopo Esc sulla ricerca il fuoco non torna al pulsante; grafici con link dentro un elemento a fuoco; 4 `nav` chiamati «Sezioni» | tutte | uscita di `inter.mjs`, axe |
| 16 | P3 | Aiuto mancante su /chiedi e /altro; aiuti lunghi non ordinati per passi | /chiedi, /altro, /nuovo, /preventivo | `hc_super_admin__chiedi.txt` |

## Non verificato
- Lettore di schermo reale (VoiceOver, TalkBack) e ingrandimento del testo al 200 %.
- Contrasto dei testi dentro i grafici SVG e dei casi che axe segna «da rivedere».
- PWA installata, telefoni veri, tastiera su schermo.
- Formato dei campi data: il browser di prova mostra «mm/dd/yyyy» anche in francese (dipende dal browser, non dall'app).
- Schede aperte solo dopo un'azione (riconciliazione di un conto, scheda di un anticipo, documento emesso, revisione del preventivo, dettaglio progetto e finanziamento) e relative etichette citate negli aiuti.
- Pannello Filtri in francese (letto in parte); ruoli responsabile, operatore, sola lettura.
