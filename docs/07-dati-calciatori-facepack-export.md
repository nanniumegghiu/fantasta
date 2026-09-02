# 07 · Listone, statistiche, facepack ed esportazione

**Scopo** · Descrivere da dove arrivano i dati dei calciatori, come si associano le foto del
facepack, e in che formato escono le rose a fine asta.
**Proprietario** · backend-engineer
**Stato** · 🟡 importazione di listone e statistiche realizzata e verificata su file costruiti · 🔴 mai provata sul file ufficiale vero · facepack ed esportazione 🔴
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

L'importatore è **tollerante**, come previsto: salta le righe di titolo sopra le intestazioni,
riconosce le colonne per contenuto e non per posizione, accetta i numeri con la virgola decimale e
sceglie la quotazione del Classic anche quando accanto c'è quella del Mantra. Prima di scrivere
qualsiasi cosa mostra **cosa ha capito**: quale riga conteneva le intestazioni, quale colonna ha
usato per ogni campo, quante righe ha letto e quali ha scartato con il motivo.

Il lettore di `.xlsx` e `.csv` è scritto dentro il progetto, senza librerie: vedi **ADR-0012**, che
spiega anche i rischi accettati e come sono mitigati.

> 🔴 **Mai provato sul file ufficiale vero.** È stato verificato su un `.xlsx` costruito a immagine
> di quello, con riga di titolo, accenti, apostrofi e virgole decimali. Non è la stessa cosa: serve
> il file vero per considerare chiusa questa parte.

### 2.2 Le statistiche

Servono le stesse richieste dall'utente: partite giocate, minuti giocati, media voto, assist, gol,
cartellini. Si aggiungono fantamedia e giornata di riferimento, perché senza sapere **a quando sono
aggiornate** un numero non significa niente.

Ogni riga di statistica porta il campo `matchday`: l'ultima giornata **completa** inclusa. Sullo
schermo e nelle tabelle compare sempre la dicitura «aggiornate alla giornata N». Se l'importazione
non è mai stata fatta, le colonne mostrano un trattino e una nota, **non zeri**: uno zero sembra un
dato, un trattino dice la verità.

L'origine di questi dati è l'importazione di un file, decisa in ADR-0003, con la struttura pronta ad
accogliere in futuro un aggiornamento automatico senza toccare lo schema.

### 2.3 Il facepack e il logopack

L'utente possiede un facepack e un logopack per Football Manager 26. La cartella è stata **ispezionata
davvero** il 2 settembre 2026, in
`Documents/Sports Interactive/Football Manager 26/graphics`. Questi sono i numeri reali:

| Cartella | File | Nome dei file |
|---|---|---|
| `faces/` | 501.690 | `<identificativo FM>.png` |
| `iconfaces/` | 501.691 | `<identificativo FM>.png` |
| `logos/clubs/normal/` | 80.568 | `<identificativo FM>.png` |
| `kits/` | molti | `<identificativo FM>_home.png` |

**Scoperta che cambia il progetto**: i file `config.xml` contengono solo mappature da identificativo
a percorso interno del gioco, e **nessun nome**. Una ricerca della parola `name` nei 38 MB del
config delle facce ha dato zero occorrenze. Gli identificativi sono quelli di Football Manager e non
hanno relazione con quelli del listone di Fantacalcio.

Serve quindi un **ponte** fra i due mondi. Come si costruisce è spiegato subito sotto: si è scoperto
che si può fare da soli, senza chiedere niente all'utente.

Il flusso, una volta esistente il ponte:

1. **Corrispondenza.** Una tabella lega l'identificativo del listone a quello di Football Manager,
   registrando **come** è nata: importata, dedotta dal nome, o confermata a mano. Le conferme
   manuali non vengono mai sovrascritte da un'importazione successiva.
2. **Estrazione mirata.** Si copiano solo le foto dei calciatori presenti nel listone, circa
   seicento, e i venti loghi di Serie A. **Non si caricano mai 501.690 immagini.**
3. **Ottimizzazione.** Ogni foto ridotta a un quadrato di 160 pixel e convertita, prima del
   caricamento. Una tabella da 500 righe con immagini a piena risoluzione è inusabile su un telefono.
4. **Abbinamento manuale del resto.** Schermata a due colonne, si accosta la foto al calciatore.
   Il punto è che l'app **non finga** di aver associato tutto.
5. **Ricaduta.** Chi non ha la foto mostra un cerchio con le iniziali sul colore del ruolo. Mai un
   riquadro rotto.

Il facepack **resta sul computer dell'utente** e non entra nel repository: è già fra i file ignorati.

#### Il ponte si costruisce da solo

Deciso in **ADR-0011**, che supera ADR-0010. L'utente non deve produrre nessun file.

Esiste un servizio pubblico di ricerca degli identificativi di Football Manager, quello che alimenta
il sito `fmref.com`, interrogabile via HTTP. Restituisce per ogni persona l'identificativo del gioco,
la squadra con il suo identificativo, il campionato e la reputazione.

Procedimento, una volta a stagione:

1. Si importa il listone ufficiale.
2. L'app scarica **in blocco** i giocatori della Serie A, sette richieste in tutto, e le venti
   squadre con i loro identificativi.
3. Abbina per cognome e squadra. Le omonimie, il 2% misurato, si sciolgono col nome di battesimo.
4. Copia dal facepack soltanto le foto abbinate, le riduce e le carica.
5. Il resto va nella schermata di abbinamento manuale.

**Tre vincoli non negoziabili**, parte della decisione:

- si scarica in blocco, mai un giocatore alla volta: sette richieste, non seicento;
- **mai durante l'asta**: la corrispondenza vive nel nostro database e la sera dell'asta il servizio
  esterno non viene interpellato per nessun motivo;
- il passo 2 deve fallire in modo pulito, perché l'indirizzo non è documentato e può chiudere. In
  quel caso resta l'abbinamento manuale.

Copertura misurata sul facepack reale: sopra il 95% per i calciatori che entrano nel listone,
20 loghi su 20 per le squadre.

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

Il formato è stato fornito dall'utente ed è fissato in **ADR-0008**. Quattro intestazioni esatte
nella prima riga:

| Intestazione | Contenuto |
|---|---|
| `Id` | Codice numerico del calciatore nel listone ufficiale |
| `Calciatore` | Cognome e nome, come nel listone |
| `Fantasquadra` | Nome esatto della squadra della lega |
| `Prezzo` | Fantamilioni spesi |

L'identificativo è dichiarato facoltativo dalle istruzioni ufficiali, ma **noi lo includiamo
sempre**: è l'unica difesa contro le omonimie, e in Serie A ce ne sono ogni anno.

> 🟡 **Resta da provare davvero.** Avere la specifica non è avere un caricamento riuscito. Prima di
> chiudere la Fetta 6 il file va caricato una volta nell'app di destinazione.

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

- ✅ Origine dei dati dei calciatori: importazione di file, ADR-0003.
- ✅ Formato di esportazione: fissato in ADR-0008. Resta da provare un caricamento vero.
- ✅ Struttura del facepack: ispezionata, vedi 2.3. Ponte deciso in ADR-0010.
- ✅ Ponte automatico deciso e misurato, ADR-0011. Niente piu esportazioni manuali.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.3 | 2026-09-02 | Importazione realizzata: lettore di .xlsx e .csv scritto nel progetto, ADR-0012. Anteprima obbligatoria prima di scrivere. |
| 1.2 | 2026-09-02 | Ponte automatico tramite servizio pubblico di ricerca, ADR-0011. |
| 1.1 | 2026-09-02 | Facepack ispezionato con numeri reali, ponte deciso. Formato di esportazione fissato. |
| 1.0 | 2026-09-02 | Prima stesura. |
