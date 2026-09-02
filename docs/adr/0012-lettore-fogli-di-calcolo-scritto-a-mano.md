# ADR-0012 · Il lettore dei fogli di calcolo è scritto nel progetto

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · backend-engineer e frontend-engineer
**Si appoggia a** · ADR-0006, che tiene l'elenco chiuso delle dipendenze

---

## Contesto

La Fetta 2 richiede di leggere il listone e le statistiche da file `.xlsx` o `.csv`. ADR-0006 aveva
lasciato la questione aperta, elencando «lettura di file Excel e CSV» fra le dipendenze da valutare
quando fosse arrivato il momento.

Il compito è più piccolo di quanto sembri: leggere una tabella di circa seicento righe da un file
prodotto da un foglio di calcolo, una volta a stagione. Non servono formule, stili, date, grafici,
fogli multipli o scrittura.

## Opzioni valutate

### A · La libreria più diffusa per gli Excel

**Pro** · Legge qualunque cosa, compresi i casi limite che non prevediamo.
**Contro** · La versione pubblicata sul registro dei pacchetti è ferma da anni e porta
vulnerabilità note. Il progetto ha una regola sulle credenziali e sui permessi molto severa: sarebbe
incoerente introdurre di proposito un pacchetto con problemi dichiarati, anche se il rischio pratico
qui è basso perché il file lo carica l'amministratore stesso.

### B · Una libreria più piccola e mantenuta

**Pro** · Nessuna vulnerabilità nota, dimensioni contenute.
**Contro** · Aggiunge comunque una dipendenza da mantenere per un compito minuscolo, e il formato
che deve leggere non cambierà mai: è uno standard fermo da quindici anni.

### C · Scriverlo nel progetto

Un `.xlsx` è un archivio ZIP che contiene file XML. Sia il browser sia Node sanno già decomprimere,
con lo stesso strumento e lo stesso nome. Il resto è leggere due file XML dalla struttura
semplicissima.

**Pro** · Nessuna dipendenza, nessuna vulnerabilità ereditata, nessun aggiornamento da seguire.
Codice leggibile e interamente nostro, con i commenti in italiano come il resto del progetto.
Funziona identico nel browser e in Node, e questo permette di **verificarlo con uno script senza
aprire una pagina**, che è la cosa che rende il pezzo affidabile.

**Contro onesto e non trascurabile** · Se il file reale avesse una struttura inattesa, il lettore
fallirebbe dove una libreria completa avrebbe retto. È un rischio vero, e va mitigato, non ignorato.

## Decisione

**Opzione C**, con tre mitigazioni che fanno parte della decisione.

1. **Si legge anche il CSV.** È la via di riserva sempre disponibile: se l'`.xlsx` non venisse letto,
   si apre il file e lo si salva come CSV. L'app lo dice esplicitamente nel messaggio d'errore.
2. **Niente importazioni silenziose.** Prima di scrivere qualsiasi cosa, la schermata mostra quale
   riga conteneva le intestazioni, quale colonna è stata usata per ogni campo, quante righe sono
   state lette e **quali sono state scartate e perché**. Un file letto male si vede subito, invece
   di scoprirlo a asta iniziata.
3. **Verifica automatica su un file vero.** Lo script `scripts/verifica-listone.mjs` costruisce da
   zero un `.xlsx` compresso davvero, con la riga di titolo sopra le intestazioni, gli accenti, gli
   apostrofi e i numeri con la virgola, e controlla che venga letto e interpretato come deve.

## Conseguenze

**Diventa più facile** · Capire cosa succede quando un'importazione va storta: il codice è lì, in
italiano, e la schermata dice cosa ha capito.

**Diventa più difficile** · Se un domani servisse leggere fogli complessi, con più tabelle, celle
unite o date formattate, questa strada non basterebbe. In quel caso si torna alle opzioni A o B con
un ADR nuovo.

**Cosa resta da verificare** · 🔴 Il lettore non ha mai visto il **file ufficiale vero**. È stato
provato su un file costruito a immagine di quello, non su quello. Finché non passa sul file reale,
questa parte va considerata funzionante ma non confermata.

## Reversibilità

**Alta.** La lettura del file è isolata in un modulo con un'interfaccia minima: prende dei byte e
restituisce una tabella di stringhe. Sostituirla con una libreria significa riscrivere quel modulo e
nient'altro.
