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

Serve quindi un **ponte**, deciso in ADR-0010: un elenco esportato da Football Manager che leghi
identificativo e nome, con l'abbinamento manuale dentro l'app a coprire ciò che resta.

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

#### Come ottenere l'elenco da Football Manager

Da fare una volta sola. Serve a produrre il ponte fra identificativi e nomi.

1. Apri Football Manager 26.
2. Vai in **Preferenze**, sezione **Interfaccia**, e attiva **Mostra ID unici**. Da quel momento
   l'identificativo compare nella scheda di ogni giocatore e di ogni club.
3. Apri una schermata con **tutti i giocatori della Serie A**. Va bene la ricerca giocatori con
   filtro sul campionato italiano.
4. Aggiungi alle colonne visibili almeno: identificativo unico, nome, squadra.
5. Seleziona tutte le righe con `Ctrl + A`, poi `Ctrl + P`. Football Manager propone di salvare la
   schermata come pagina web o file di testo: scegli il formato disponibile e salva.
6. Metti il file in `dati-privati/` dentro la cartella del progetto. Quella cartella è esclusa dal
   versionamento.

**Se il passaggio 4 non ti fa aggiungere l'identificativo fra le colonne, fermati e dimmelo.**
In quel caso la strada dell'esportazione non è percorribile e si passa all'abbinamento manuale,
come previsto da ADR-0010. Non provare a ricavare gli identificativi in altri modi: meglio saperlo
subito che scoprirlo con seicento abbinamenti sbagliati.

Per i **loghi delle squadre** basta molto meno: gli identificativi delle venti squadre di Serie A,
che si leggono nella scheda di ogni club una volta attivata la preferenza del punto 2. Venti numeri.

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
- 🔴 Serve l'elenco esportato da Football Manager con identificativo e nome.
- 🔴 Servono i venti identificativi dei club di Serie A per i loghi.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.1 | 2026-09-02 | Facepack ispezionato con numeri reali, ponte deciso. Formato di esportazione fissato. |
| 1.0 | 2026-09-02 | Prima stesura. |
