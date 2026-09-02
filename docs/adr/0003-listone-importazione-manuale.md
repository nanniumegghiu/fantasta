# ADR-0003 · Listone e statistiche per importazione di file

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
project-manager

---

## Contesto

L'app ha bisogno dell'elenco dei calciatori quotati e delle loro statistiche di campionato:
partite giocate, minuti, media voto, gol, assist, cartellini. Queste informazioni esistono in due
forme: file ufficiali scaricabili, e pagine web da cui si potrebbero raccogliere automaticamente.

## Opzioni valutate

### A · Importazione di un file

**Pro** · Il listone è esattamente quello della lega, senza sorprese. Nessuna dipendenza da servizi
esterni che possono cambiare o smettere di funzionare. Nessun problema con i termini d'uso.
Funziona anche se la connessione è ballerina la sera dell'asta, perché i dati sono già dentro.

**Contro** · È un passaggio manuale, e il metodo adottato chiede di evitarli. Le statistiche restano
ferme fino al caricamento successivo.

### B · Raccolta automatica da fonte pubblica

**Pro** · Statistiche sempre aggiornate senza intervento.

**Contro** · Si rompe quando il sito di origine cambia struttura, cosa che non si può prevedere né
programmare. I termini d'uso dei principali siti di fantacalcio in genere vietano la raccolta
automatica: il rischio pratico per un'app fra amici è trascurabile, ma va dichiarato. Soprattutto,
introduce una dipendenza da qualcosa che non controlliamo, in un momento in cui non ce lo possiamo
permettere.

### C · Ibrida

Importazione manuale come base garantita più un aggiornamento automatico opzionale.

## Decisione

**Importazione di un file**, con la struttura dei dati già predisposta per accogliere in futuro un
aggiornamento automatico senza modifiche allo schema.

Il passaggio manuale viene ridotto al minimo: si trascina il file, l'app riconosce le colonne per
contenuto e non solo per intestazione, mostra un'anteprima con quante righe ha letto e quante non ha
capito, e solo dopo conferma scrive. L'operazione è ripetibile senza creare duplicati.

## Conseguenze

**Diventa più facile** · Avere la certezza che la sera dell'asta i dati ci sono e sono quelli
giusti. Provare l'app con listoni di stagioni diverse.

**Diventa più difficile** · Ricordarsi di aggiornare le statistiche. Mitigazione: ogni schermata che
mostra statistiche riporta **a quale giornata sono aggiornate**, e se l'importazione non è mai stata
fatta le colonne mostrano un trattino con una nota, mai degli zeri che sembrerebbero dati veri.

**Rischio accettato** · Se il formato del file ufficiale cambia di stagione in stagione,
l'importatore va ritoccato. Per questo riconosce le colonne in modo tollerante.

## Reversibilità

**Alta.** Aggiungere in seguito un aggiornamento automatico non richiede di toccare né lo schema né
il resto dell'applicazione.
