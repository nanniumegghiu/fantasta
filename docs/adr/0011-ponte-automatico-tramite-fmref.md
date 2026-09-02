# ADR-0011 · Il ponte fra facepack e listone si costruisce da solo

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
backend-engineer
**Supera** · ADR-0010, la cui premessa non è più valida

---

## Contesto

ADR-0010 dava per necessaria un'esportazione manuale da Football Manager, perché il facepack è
nominato con gli identificativi del gioco e i suoi file di configurazione non contengono nomi.

L'utente ha segnalato `fmref.com`, uno strumento di ricerca degli identificativi di Football
Manager pubblicato da sortitoutsi.net. L'analisi ha mostrato che il sito è un'applicazione che
interroga un servizio di ricerca raggiungibile via HTTP, i cui parametri di accesso sono contenuti
nel codice del sito stesso: indirizzo, chiave di sola lettura e nome dell'archivio.

## Cosa è stato verificato, non ipotizzato

| Verifica | Esito |
|---|---|
| Il servizio risponde a richieste diverse da quelle del sito | Sì |
| Restituisce l'identificativo di Football Manager del giocatore | Sì, Lautaro Martínez è `14110660` |
| Quell'identificativo corrisponde a un file reale del facepack | Sì, e la foto aperta è davvero lui |
| Restituisce l'identificativo del club | Sì, Inter è `1135`, logo presente |
| Si può filtrare per campionato e scaricare in blocco | Sì, 1710 giocatori di Serie A in 7 richieste |
| Le venti squadre di Serie A hanno il logo nel logopack | 20 su 20 |

Copertura delle foto, misurata incrociando gli identificativi con i file sul disco:

| Fascia per reputazione | Giocatori | Con foto | Copertura |
|---|---|---|---|
| primi 200 | 200 | 192 | 96,0% |
| dal 201 al 400 | 200 | 198 | 99,0% |
| dal 401 al 600 | 200 | 146 | 73,0% |
| oltre il 600 | 1110 | 273 | 24,6% |

Il calo oltre il quattrocentesimo riguarda le squadre primavera, che nel listone del fantacalcio non
compaiono. Sui calciatori realmente acquistabili la copertura sta sopra il 95%.

Affidabilità dell'abbinamento per cognome e squadra, che è la forma in cui il listone dà i dati: su
1710 giocatori solo 35, il 2%, hanno un cognome che si ripete dentro la stessa squadra. Si
distinguono con il nome di battesimo, che il servizio restituisce insieme alle varianti senza
accenti.

## Decisione

**Il ponte si costruisce automaticamente.** Nessuna esportazione da Football Manager.

Il procedimento, eseguito una volta a stagione:

1. Si importa il listone ufficiale.
2. L'app scarica **in blocco** l'elenco dei giocatori di Serie A, sette richieste in tutto, e le
   venti squadre con i loro identificativi.
3. Abbina per cognome e squadra, sciogliendo le omonimie con il nome di battesimo e la reputazione.
4. Copia dal facepack **soltanto** le foto abbinate, circa seicento, le riduce e le carica.
5. Ciò che resta scoperto va nella schermata di abbinamento manuale, che serve comunque.

La corrispondenza viene **salvata nel nostro database**, con l'indicazione di come è nata:
scaricata, dedotta, o confermata a mano. Le conferme manuali non vengono mai sovrascritte.

## Conseguenze

**Diventa più facile** · Tutto: l'utente non deve produrre nessun file. La stagione prossima si
rilancia il procedimento e cambia solo il listone.

**Diventa più difficile** · Nulla, ma tre vincoli vanno rispettati e sono parte della decisione.

1. **Si scarica in blocco, mai un giocatore alla volta.** Sette richieste una volta a stagione
   invece di seicento. È infrastruttura di qualcun altro e va trattata con misura.
2. **Mai durante l'asta.** La corrispondenza si costruisce prima e vive nel nostro database. La
   sera dell'asta il servizio esterno non viene interpellato per nessun motivo.
3. **L'indirizzo non è documentato** ed è il canale interno di un sito di terzi. Può cambiare o
   chiudere senza preavviso. Per questo il passo 2 fallisce in modo pulito e l'app ripiega
   sull'abbinamento manuale, che resta sempre disponibile.

**Dichiarato all'utente e accettato** · Le immagini del facepack sono opera di terzi, distribuite
per l'uso personale dentro Football Manager. Finiscono in un'applicazione privata usata da un gruppo
di amici. Il rischio pratico è vicino a zero ed è stato comunicato prima della decisione, non dopo.

## Reversibilità

**Alta.** Se il servizio esterno smette di funzionare, resta esattamente ciò che prevedeva
ADR-0010: l'abbinamento manuale. Le corrispondenze già salvate non si perdono.
