# YouCount: esperienza dell'OPERATORE (375 px, IT/FR)

Revisore UX indipendente (strumenti da campo) · 16/11/2026 · copia locale di sviluppo · prove in `/tmp/yc-final/work/op/` (schermate, script, `*.log`)
Nota: alle 15:55 il server si è riavviato e ha ripristinato i dati dimostrativi (`watchdog.log`). I movimenti MOV-006…010 creati prima sono spariti, ma le prove restano nelle schermate. Telefono vero e PWA installata: **non verificati**.

## Prove svolte
| # | Percorso | Tocchi / tempi | Esito |
|---|---|---|---|
| 1 | Prima apertura (home__1/2) | 0 | Dashboard personale chiara |
| 2 | Contanti MGA con foto / senza giustificativo (s2a_*, s2b_*) | ~10 tocchi + 1 testo | Ritaglio, lettura, motivo rapido, focus sull'errore |
| 3 | Di tasca propria (s3_*) | salvataggio 11,3 s | «La trovi in Da rimborsare» |
| 4 | Anticipo richiesta→consegna→spesa (s4*) | richiesta 3,5 s | Saldo in mano prima/dopo |
| 5 | Bozza, modifica, segnalazione (s5*) | registrazione 1,2 s | Bozza incompleta **non si salva** |
| 6 | Ritrovare, «Verificato» (s6c_*) | 2 tocchi + ricerca | Chi e quando ha verificato |
| 7 | Autocertificazione (s7c_*, autocert.pdf) | 3 campi + 1 tocco | «Cosa fare ora» chiaro |
| 8-10 | Aiuto (s8_*), errori (s9_*), senza rete (off_1) | n/d | Coda offline ottima |

## Voti
| Area | Voto | Funziona | Non funziona | Per arrivare a 9-10 |
|---|---|---|---|---|
| Facilità per l'operatore | **8** | Dashboard su misura, «+» centrale, codici frequenti come pulsanti, conto e progetto proposti dall'ultimo movimento | Modulo lungo 3 schermate; operatore vede conti Italia, 14 «modalità di pagamento», scheda Conti con saldi di tutto l'ente (Madagascar −3.831 € in rosso, conti__1) | Nascondere all'operatore conti EUR, modalità di pagamento e note (in «Altri dettagli»); Conti → solo «i miei contanti» |
| Registrazione spesa (telefono) | **8** | Foto → ritaglio → lettura AI; motivi rapidi; tasso automatico; anticipo con saldo prima/dopo | Bozza bloccata; importo senza conto letto in € (8.000 → «8.000,00 €», s5b_1); anticipo non preselezionato pur essendo l'unico | Bozza con solo importo e descrizione; valuta predefinita MGA per l'operatore in Madagascar; preselezionare l'unico anticipo |
| Chiarezza stati e prossimi passi | **8** | Badge «Da verificare / Verificato / In attesa di rimborso / motivo dichiarato»; messaggi di conferma con il numero MOV; «Cosa fare ora» | Prima di generare il PDF, Da fare dice «Tutto in ordine» (s7c.log); la segnalazione non lascia traccia nella scheda; «Bozza · Uscita» + «In attesa di rimborso» insieme | Voce Da fare «Autocertificazione da preparare»; nella scheda «Segnalazione inviata il… · in attesa» |
| Errori e recupero | **7,5** | Errori elencati insieme, con focus sul campo; date bloccate con spiegazione; decimali MGA arrotondati con avviso; coda offline ottima | Bozza incompleta rifiutata con «Per registrare mancano…»; conti EUR senza avviso (45.000 €); data del documento 2027 accettata; «manca descrizione» quando è solo troppo corta | Avviso «importo insolito / conto Italia?»; testi d'errore precisi («almeno 3 caratteri», «data non ammessa») |
| Aiuto e guida | **7** | «i» su ogni scheda; «Come faccio a…» con «Portami lì →»; FR completo | Paragrafi lunghi e densi; l'aiuto Dashboard descrive prima la vista amministratore; contraddizioni: «per la bozza bastano importo e conto», «è già scelto il tuo anticipo», «riso» (dà 101-108, il 307 per ultimo) | Aiuto per ruolo, 3-5 punti numerati; correggere le tre contraddizioni |
| Francese per l'operatore | **8,5** | Traduzione naturale («Comptabiliser», «Attestation sur l'honneur»), errori e aiuto in FR | Tu/vous misti («Que dois-tu acheter»); nel PDF FR il motivo resta in italiano («Venditore senza ricevuta»); «payée par ____» vuoto | Motivi rapidi salvati come codice e tradotti nel PDF; usare sempre «vous» |
| Velocità percepita | **7** (sviluppo) | FCP 0,4-1,1 s con cache; registrazione 1-3 s; offline senza attese | Salvataggi fino a 11 s; ~3-4,6 MB per pagina; rete 3G simulata: FCP 6,4 s, networkidle 60-96 s; prime aperture fino a 23 s (compilazione in sviluppo) | Misurare in produzione; mettere «Registra» in coda subito, come offline; alleggerire /nuovo |
| **Esperienza operatore complessiva** | **8** | Percorso principale solido, offline affidabile, anticipi ben spiegati | Bozza, conti e anticipi non filtrati, aiuto prolisso | I 10 interventi sotto portano a 9 |

Velocità (`speed.mjs`, 375 px, freddo → caldo, ms): / 592→452 (idle 1,6-2,1 s) · /nuovo 772→632 (2,1-2,5 s) · /movimenti 884→2.280 (3,8-6,9 s) · scheda movimento 1.092→752 · /rimborsi 23.424 (prima compilazione)→380.

## Difetti
| G. | Difetto | Pagina · larghezza | Prova |
|---|---|---|---|
| P1 | «Salva bozza» rifiutata se mancano conto, codice o giustificativo, con il messaggio «Per registrare mancano…»; contraddice Guida e Dashboard | /nuovo · 375 | s5b_1, s5a_1_p2, s8.log |
| P1 | L'operatore può scegliere Banca Italia, PayPal…: 45.000 diventa «45.000,00 €» senza avviso; senza conto l'importo vale € | /nuovo · 375 | s9.log, s9_eur, s5b_1 |
| P2 | Senza un anticipo proprio, «Anticipo di» propone quelli di altri (Fanomezantsoa, referente) | /nuovo · 375 | s4a log |
| P2 | Richiesta di anticipo: «Chi riceve i contanti» predefinito su un'altra persona | /anticipi?nuova=1 | s4b log |
| P2 | Autocertificazione non ancora preparata: Da fare «Tutto in ordine» | / · 375 | s7c.log |
| P2 | Segnalazione d'errore: nessuna traccia nella scheda; in Scadenze l'operatore vede «Fatta» e può chiuderla da solo | /movimenti/id, /scadenze | s5e log, s5d_scad_p1 |
| P2 | Scheda Conti: saldi di tutto l'ente, Madagascar negativo in rosso, «16 movimenti da verificare» | /conti · 375 | conti__1 |
| P2 | Aiuto prolisso e misto per ruolo, con 3 contraddizioni (bozza, anticipo preselezionato, «riso») | «i» · 375 | s8_nuovo, s8.log, probe2 |
| P2 | PDF FR: motivo in italiano, «payée par ____» vuoto | autocertificazione | autocert.pdf |
| P3 | Codice contabile vuoto nella conferma subito dopo la registrazione (scelto col pulsante); compare ricaricando | /movimenti/id | s2b_4_p0-1, s3 log |
| P3 | Bozza registrata: conferma «Modifiche salvate.» invece di «Movimento registrato MOV-…» | scheda | s5c log |
| P3 | «Importo letto» anche senza foto | /nuovo | s2b log |
| P3 | «1 movimenti» | /movimenti · 1440 | log s2a |
| P3 | Data del documento futura (2027) accettata | /nuovo | s9.log |
| P3 | «Apri il PDF qui sotto», ma il PDF è sopra; grande riquadro vuoto «Anteprima non disponibile» | scheda | s7c_2_p1 |
| P3 | Finestra «Ritaglia»: pulsanti di altezza diversa; Scadenze: filtri a pillola asimmetrici | 375 | s2a_1, s5d_scad_p1 |
| P3 | FR: «tu» nella richiesta di anticipo | /anticipi · FR | fr.log |
| P3 | Scadenze e «Da rimborsare» con contenuti da amministratore («Nuova scadenza», fine finanziamento, «Rimborsato nel 2026») | 375 | s5d_scad_p0-1, s3_rimb_p0 |

## I 10 interventi più efficaci
1. Bozza salvabile con importo e descrizione (anche senza conto, codice o giustificativo), con il messaggio «Bozza salvata, mancano: …».
2. Per l'operatore, solo casse e conti del Madagascar (MGA) e valuta predefinita MGA; avviso se l'importo in € supera una soglia.
3. «Anticipo di»: solo il proprio anticipo, preselezionato; se non c'è, «Non hai contanti in mano: chiedi un anticipo →».
4. Richiesta di anticipo: destinatario predefinito sull'operatore stesso.
5. Da fare: «Autocertificazione da preparare (MOV-…)» subito dopo la registrazione senza giustificativo.
6. Segnalazione d'errore visibile nella scheda («inviata il… · in attesa / corretta»); «Fatta» solo per i responsabili.
7. Aiuto per l'operatore in 3-5 punti numerati, senza la parte amministratore; correggere le tre contraddizioni.
8. Modulo corto: «Fornitore, modalità di pagamento, note» chiusi sotto «Altri dettagli» (−1 schermata).
9. Velocità: con rete lenta, «Registra» mette subito in coda (come offline) e conferma in meno di 1 s; misurare FCP in produzione.
10. PDF FR coerente (motivo tradotto, «payée par» compilato) e Conti operatore ridotto a «I miei contanti».

Tutti gli interventi riguardano filtri e testi: l'app resta semplice.
