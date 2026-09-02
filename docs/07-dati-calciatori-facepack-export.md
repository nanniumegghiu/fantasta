# 07 · Listone, statistiche, facepack ed esportazione

**Scopo** · Descrivere da dove arrivano i dati dei calciatori, come si associano le foto del
facepack, e in che formato escono le rose a fine asta.
**Proprietario** · backend-engineer
**Stato** · 🔴 non implementato · 🟡 due punti dipendono da file che devo ancora vedere
**Data** · 2026-09-02

---

## 1. Cosa fa

Tre flussi di dati distinti, spesso confusi fra loro:

1. **Il listone**: chi sono i calciatori quotati e quanto valgono. Cambia una volta a stagione.
2. **Le statistiche**: come stanno andando. Cambiano ogni giornata.
3. **Le foto**: il facepack dell'utente. Si caricano una volta e basta.

E un flusso in uscita: **l'esportazione delle rose** in un formato che l'app Fantacalcio sappia
leggere.

## 2. Come funziona

### 2.1 Il listone

Il listone entra nel sistema tramite **importazione di un file** fatta dall'amministratore
dell'applicazione, non dal singolo utente. Il file atteso è quello ufficiale delle quotazioni, in
formato Excel o CSV, con almeno queste colonne:

| Colonna attesa | Nel modello |
|---|---|
| Id | `players.id` |
| R (ruolo) | `players.role` |
| Nome | `players.name` |
| Squadra | `players.serie_a_team` |
| Qt.A o Quotazione | `players.quotation` |

L'importazione è **idempotente**: rilanciarla sullo stesso file non crea duplicati, aggiorna. Un
calciatore che sparisce dal listone non viene cancellato se qualcuno l'ha già comprato: verrebbe giù
mezza rosa.

> 🟡 **Da verificare sul file reale.** I nomi esatti delle colonne cambiano di stagione in stagione.
> L'importatore va scritto tollerante: riconosce le colonne per contenuto e non solo per intestazione,
> e prima di scrivere mostra un'anteprima con quante righe ha letto e quante non ha capito.

### 2.2 Le statistiche

Servono le stesse richieste dall'utente: partite giocate, minuti giocati, media voto, assist, gol,
cartellini. Si aggiungono fantamedia e giornata di riferimento, perché senza sapere **a quando sono
aggiornate** un numero non significa niente.

Ogni riga di statistica porta il campo `matchday`: l'ultima giornata **completa** inclusa. Sullo
schermo e nelle tabelle compare sempre la dicitura «aggiornate alla giornata N». Se l'importazione
non è mai stata fatta, le colonne mostrano un trattino e una nota, **non zeri**: uno zero sembra un
dato, un trattino dice la verità.

L'origine di questi dati è una **decisione aperta**: importazione manuale periodica oppure raccolta
automatica. Vedi `docs/09-decisioni-aperte.md`.

### 2.3 Il facepack

L'utente possiede già una raccolta di foto. Il flusso previsto:

1. **Caricamento in blocco.** Una schermata amministrativa accetta una cartella o un archivio ZIP.
2. **Associazione automatica.** Tre tentativi in ordine:
   - il nome del file è l'identificativo del listone, per esempio `2764.png`: associazione certa;
   - il nome del file è nome e cognome, per esempio `lautaro_martinez.png`: si normalizza togliendo
     accenti, maiuscole e separatori, e si confronta col listone;
   - somiglianza approssimata, con soglia alta, per i casi come `martinez_l.png`.
3. **Risoluzione manuale del resto.** Le foto non associate finiscono in una schermata di
   abbinamento a due colonne: si trascina la foto sul calciatore. Cinquanta abbinamenti si fanno in
   pochi minuti; il punto è che l'app **non finga** di aver associato tutto.
4. **Ottimizzazione.** Ogni foto viene ridimensionata a un quadrato di 160 pixel e convertita in
   WebP prima di essere salvata. Una tabella di 500 righe con 500 fotografie a piena risoluzione
   sarebbe inutilizzabile su un telefono.
5. **Ricaduta.** Chi non ha la foto mostra un cerchio con le iniziali sul colore del ruolo. Mai un
   riquadro rotto.

Le foto stanno nell'archivio file del backend, non nel repository: sono centinaia di file binari che
non hanno niente da fare in un sistema di versionamento del codice. Per questo `facepack/` è
nell'elenco dei file ignorati.

> 🟡 **Da vedere.** Come sono nominati i file del facepack e quanti sono. Da questo dipende quanto
> lavoro manuale resta all'utente al punto 3.

### 2.4 Il listone svincolati durante l'asta

È una vista sul listone che esclude i calciatori già acquistati **in quella lega**. Requisiti
dell'utente, tutti obbligatori:

- colonne: foto, nome, squadra di Serie A, ruolo, quotazione, partite giocate, minuti, media voto,
  gol, assist, ammonizioni, espulsioni;
- filtro per ruolo e per squadra di Serie A;
- ordinamento su **ogni** colonna statistica;
- aggiornamento immediato: un calciatore aggiudicato sparisce dalla lista per tutti.

Con 500 righe e dieci colonne su un telefono, la tabella va costruita con rendering a finestra,
disegnando solo le righe visibili. Una tabella normale a 500 righe scatta durante lo scorrimento, e
questo si nota subito.

### 2.5 L'esportazione a fine asta

Quando tutte le rose sono complete, ogni utente può esportare **la propria rosa** o **tutte le
rose**, in un file CSV pensato per essere caricato nell'app Fantacalcio.

Colonne previste: identificativo del calciatore, ruolo, nome, squadra di Serie A, costo di
acquisto, e il nome della squadra fantacalcistica per l'esportazione completa.

> 🟡 **Punto onesto: non conosco con certezza il formato esatto accettato dal caricamento rose di
> Fantacalcio.it, e non voglio scriverlo a memoria.** Serve un file di esempio, anche vuoto,
> scaricato dalla sezione di caricamento rose della lega. Con quello l'esportazione si allinea al
> byte. Finché non ce l'ho, l'app produrrà un CSV generico e leggibile, e l'interfaccia dirà
> chiaramente che il formato non è ancora stato verificato contro l'app di destinazione.

## 3. File coinvolti

🔴 Nessuno. Previsti: `app/src/features/import/`, `app/src/features/export/`,
`app/scripts/import-listone.ts`.

## 4. Decisioni e perché

- **Le foto si ottimizzano al caricamento, non alla lettura.** Ridimensionare 500 immagini una volta
  costa una volta; farlo a ogni apertura costa a ogni apertura.
- **Il calciatore acquistato non si cancella mai.** Le rose puntano ai calciatori: cancellarli
  romperebbe lo storico.
- **La giornata di riferimento è sempre visibile.** Un dato senza data è un dato inaffidabile.

## Da sapere prima di intervenire

I nomi dei calciatori nel listone e nei facepack **non coincidono quasi mai**: accenti, secondi nomi,
abbreviazioni. Qualsiasi associazione automatica al 100% è un'illusione. Progetta sempre la strada
manuale accanto a quella automatica.

## Aperto / TODO

- 🔴 Origine delle statistiche: decisione aperta.
- 🔴 Formato di esportazione: serve un file di esempio dall'utente.
- 🟡 Struttura e dimensione del facepack: da vedere.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.0 | 2026-09-02 | Prima stesura. |
