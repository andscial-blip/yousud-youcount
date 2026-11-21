# YouCount — Operatore, quattordicesimo giro (375 px)

Il server si è riavviato due volte e i dati demo si sono ricaricati. Ho rifatto la preparazione: richiesta di 80.000 MGA come operatore, poi autorizzazione e consegna come super_admin. Schermate in `/tmp/yc-final/work/op14_*.png` e `op_*.png`; script in `work/op14/`.

## A. Riverifica dei difetti precedenti

| Id | Esito | Prova |
|---|---|---|
| Q1 Un solo risultato non scelto | **CHIUSO in pagina** | Con «riso» il menu dice «1 codice trovato: toccalo qui sopra» e il pulsante 307 si accende al tocco (`op14_cerca_riso`, `op14_r_code2`). Resta però una contraddizione nella Guida → R2 |
| Q2 «mancano: giustificativo» senza motivo | CHIUSO | «Campo obbligatorio» sotto «Perché manca», la pagina scorre fino al campo (`op14_q2_msg`) |
| Q3 «Salva da rimborsare» non apre il modulo | CHIUSO | URL `?ok=new&aut=1`, scrollY 980, riquadro «Completa qui sotto l'autocertificazione» (`op14_q3_after`) |
| Q4 /rimborsi da amministratore | **APERTO (ridotto)** | Il riquadro «Da documentare» non c'è più e il titolo non è più tagliato. Restano «Rimborsi da effettuare», «Operatore · 1 persona», «la più vecchia: 21/11, Operatore Prova» e, a vuoto, «non dobbiamo niente a nessuno» (`op_rimb__1`, `op_rimb2__1`) |
| Q5 Due nomi per i contanti | CHIUSO | «Contanti in mano», con gli euro in grande, in Dashboard, /anticipi, aiuto e Guida (`op_ant2__1`) |
| Q7 «bozza» sotto la data | CHIUSO | 1440: «21/11/2026 · da rimborsare» (`op_mov1440__1`) |
| O4 Progetto dell'anticipo che resta | CHIUSO | Passando ad «Anticipo», poi a «Soldi di YouSud» o «Di tasca propria», il progetto torna a «Scegli…» |
| N-6 PDF FR «Spese generali» | **APERTO** | «Lieu et date :» ora va bene. Nel corpo del testo c'è «« Frais généraux »», ma l'intestazione dice «Projet Spese generali» (`work/op14/auto_fr.pdf`) |
| N9-5 Diciture FR | CHIUSO | «fonds propres» non c'è più; «Comptabilisé» va bene. Le diciture «Payée personnellement / de votre poche / de ma poche» seguono lo stesso schema dell'italiano |
| N-2 Data UTC | **NON VERIFICATO** | Ho provato tra le 09 e le 10 UTC, quando la data UTC e quella di Antananarivo coincidono. Indizi a favore: «Inserito 21/11/2026, 12:10», cioè l'ora EAT, e «Oggi» uguale in Scadenze e in Dashboard. Va riprovato tra le 00:00 e le 03:00 di Antananarivo |

## B. Compiti e voti

| Area | Prec. | Voto | Difetti contati | Motivo |
|---|---|---|---|---|
| Facilità complessiva | 9 | **9** | Q4, R4 (P3) | La Dashboard è chiara. «Da fare» guida bene: «Anticipo autorizzato: ritira 80.000 MGA», poi «Hai in mano 65.000 MGA · Porta le ricevute entro il 06/12/2026 · Registra» |
| Registrare una spesa | 8,5 | **9** | R1 (P3) | Foto → Ritaglia → «Usa» → «caricato». Con i contanti in mano il modulo parte da «Anticipo», con il progetto e la riga «dopo questa spesa: 65.000». La descrizione propone il codice subito sotto («Codice suggerito: 307»). Ricerca: riso → 307, taxi → 202, pane → 307, tessuti → 401. «MOV-2026-007 registrato» |
| Capire gli stati | 9 | **9** | R3 (P3) | Bozza / Da verificare / Verificati / Da rimborsare sono uguali nell'elenco, nella scheda, nei filtri, nell'aiuto e nella Guida |
| Errori e recupero | 9 | **9** | R5 (P3) | Bozza vuota: «mancano: importo» con il campo segnato. Bozza completata con «Modifica» → «Registra»: ogni campo che manca è segnato. Segnalazione: riquadro «Segnalato il 21/11/2026, in attesa del responsabile», più «Da fare» e Scadenze. Conta con differenza di 20.621.300 MGA: serve la spunta (che ora si attiva anche toccando il testo) e la nota obbligatoria («Campo obbligatorio», `op14_conta1`) |
| Aiuto in pagina e Guida | 9 | **9** | R2, R6 (P3) | Gli aiuti sono brevi (39–118 parole), scritti per l'operatore, e il testo compare subito (non più «…»). Le due incongruenze sono nella Guida |
| Francese | 9 | **9** | N-6 (P3) | Dashboard, /nuovo, /anticipi, /rimborsi, schede, Scadenze e PDF sono tradotti. Lingua riportata all'italiano (verificato) |
| Velocità percepita | 8,5 | **9** | — | Ricaricamento completo dal 2° giro: 1,9–2,8 s. Navigazione dalla barra: 0,1–0,5 s. Bozza 0,9–1,2 s; «Registra» con o senza foto 1,1 s, con «Salvataggio…» sul pulsante giusto (`op14_save_during`). Durante i riavvii ho visto picchi di 11–17 s, che non ho contato. Rete lenta vera e PWA: non verificato |
| **Complessivo** | **8** | **8,5** | 8 P3, nessun P2 | Nessun compito si blocca. Per il 9 servono al massimo due P3 in tutto |

Nessuna area scende rispetto al giro precedente.

## C. Difetti nuovi

| Id | Gravità | Area | Dove | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| R1 | P3 | Registrare | /nuovo, ricerca del codice | Con una parola senza risultati il messaggio dice «…o scegli dall'elenco». Ma il menu contiene solo «0 codici trovati: toccane uno qui sopr[a]»: non c'è niente da toccare né da scegliere, e la scritta è tagliata a 375. Uguale in FR | `op14_cerca_xyzzy`; menu con 1 sola voce (`search2.mjs`) | Con 0 risultati il menu deve mostrare tutto il piano dei conti, oppure il messaggio deve dire «Tocca × per vedere tutti i codici». Testo del menu più corto («Nessun codice trovato») |
| R2 | P3 | Guida | /guida, «Registrare una spesa o un'entrata» | «se resta un solo codice, è già scelto»: è falso (vedi Q1). Chi si fida della Guida si trova poi «mancano: codice contabile» | `work/op14/guida.mjs` | Scrivere: «se resta un solo codice, toccalo» |
| R3 | P3 | Stati | Dashboard IT e FR | Il riquadro si chiama «In attesa di verifica» («En vérification»), mentre l'etichetta della spesa e l'aiuto dicono «Da verificare» («À vérifier») | `op_dash3`, testo FR | Titolo del riquadro: «Da verificare» / «À vérifier» |
| R4 | P3 | Facilità | /scadenze (operatore) | La spesa di tasca propria compare come «Rimborsi da pagare: 1 · Pagamento», ma per l'operatore è un rimborso da ricevere. La legenda «critica (sanzioni) / alta (finanziatori)» è da amministratore | testo /scadenze | Per l'operatore: «Rimborso che ti spetta». Legenda ridotta a «scaduta / in arrivo / fatta» |
| R5 | P3 | Errori | Scheda registrata, dopo la segnalazione | Sotto «Segnalato… in attesa» restano attivi il campo vuoto e «Segnala al responsabile»: è facile mandare un doppione (non l'ho provato) | `op14_segn` | Nascondere il modulo e mostrare un link «Aggiungi un dettaglio alla segnalazione» |
| R6 | P3 | Guida | /guida | (a) «scegli… il conto da cui è uscito il denaro»: l'operatore vede «Come è stata pagata» (Soldi di YouSud / Di tasca propria / Anticipo). (b) «Tocca «+ Nuovo movimento»» come primo passo, mentre il pulsante dell'operatore è «Registra una spesa». (c) «la vedi in «Rimborsato a te»»: il riquadro si chiama «Rimborsato nel 2026» | `guida.txt`, `op_rimb2__1` | Versione della Guida per l'operatore con i nomi esatti dei pulsanti e dei riquadri |

Non segnalati come difetti:
- Anteprima rotta del giustificativo nella scheda. L'archivio locale (porta 3400) restituisce i file in multipart, quindi è un limite di questa copia: non verificato.
- Cassa Madagascar a −20,5 milioni di MGA: sono i dati demo dopo il ricaricamento, e l'app avvisa correttamente.

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

Tutte le aree sono già a 9. Per portare anche il complessivo a 9 (al massimo due P3 in tutto), in ordine di effetto:

1. **R2 + R6**: allineare la Guida dell'operatore allo schermo (codice da toccare, «Come è stata pagata», «Registra una spesa», «Rimborsato nel …»). Basta una revisione del testo.
2. **Q4 + R4**: /rimborsi e /scadenze dal punto di vista dell'operatore: «Le tue spese da rimborsare», niente «1 persona», «Operatore» o «non dobbiamo niente a nessuno»; «Rimborso che ti spetta»; legenda ridotta.
3. **R1**: ricerca senza risultati che riporta a tutti i codici, con un testo breve che non venga tagliato.
4. **R3**: «Da verificare» anche nel titolo del riquadro della Dashboard (IT e FR).
5. **R5**: nascondere il modulo di segnalazione quando ce n'è già una aperta.
6. **N-6**: tradurre il nome del progetto anche nell'intestazione del PDF FR («Projet Frais généraux»).
7. **N-2**: ripetere la prova tra le 00:00 e le 03:00 di Antananarivo (data proposta in /nuovo, /anticipi, conta, «Segnalato il») per chiuderlo con una prova.
