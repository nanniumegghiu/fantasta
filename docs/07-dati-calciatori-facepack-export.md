# 07 · Listone, statistiche, facepack ed esportazione

**Scopo** · Descrivere da dove arrivano i dati dei calciatori, come si associano le foto del
facepack, e in che formato escono le rose a fine asta.
**Proprietario** · backend-engineer
**Stato** · ✅ listone vero caricato, 531 calciatori 2026/27 con statistiche · ✅ facepack al **95%** e
20 stemmi su 20 · ✅ esportazione costruita e provata, 🔴 **mai caricata davvero nell'app Fantacalcio**
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

> **Il listone è unico per tutta l'applicazione.** Non è per lega e non è per utente: esiste una
> volta sola, lo carica il fondatore, e da quel momento lo vede chiunque abbia fatto l'accesso, su
> qualsiasi dispositivo. Nessun partecipante deve caricare niente, e non esiste un modo per farlo:
> la scrittura è riservata agli amministratori dell'applicazione. Verificato con un utente che non
> ha nessun potere e che vede comunque quello che ha caricato il fondatore.

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

## 2bis. I volti, come sono arrivati davvero

Fetta 5, costruita il 3 settembre 2026 seguendo ADR-0011. Il procedimento è in
`scripts/volti.mjs` e si fa in tre passi separati, perché falliscono in modi diversi:

| Passo | Cosa fa | Quando si rilancia |
|---|---|---|
| `--scarica` | Sette richieste al servizio di ricerca, elenco della Serie A in `.cache/` | Una volta a stagione |
| `--abbina` | Incrocia listone e Football Manager, e **dice cosa farebbe senza fare niente** | Ogni volta che si migliora una regola |
| (senza argomenti) | Tutti e tre, e carica le immagini | Quando l'abbinamento convince |

### Le regole di abbinamento, e perché sono quelle

**I nomi si normalizzano** togliendo accenti e punteggiatura: i due elenchi scrivono «Martínez» e
«Martinez», «O'Riley» e «O Riley». Senza, si perderebbe un nome su dieci per motivi tipografici.

**Le squadre si riducono alla parola che le identifica**: «F.C. Internazionale Milano» → Inter. Una
tabella di traduzione andrebbe aggiornata a mano a ogni cambio di denominazione sociale.

**Le iniziali puntate si tolgono.** Il listone scrive «Gonzalez N.», «Esposito Se.», «Ederson D.S.»
quando due calciatori condividono il cognome. Trattarle come cognomi costava **76 abbinamenti**: è
stata la correzione più redditizia di tutte. L'iniziale non si butta però: serve a sciogliere
l'ambiguità fra due Gonzalez.

**Nel dubbio non si abbina.** Due candidati che l'iniziale non distingue restano senza foto. Una
faccia sbagliata sullo schermo condiviso non la corregge nessuno: ci si ride sopra e resta lì tutta
la serata.

### Il risultato misurato, non stimato

Sul listone caricato dall'utente, 531 calciatori:

| | Quanti |
|---|---|
| Abbinati | 437 |
| Con la foto davvero presente nel facepack | 420 |
| Caricati | 403 |
| Ambigui, lasciati stare | 4 |
| Non trovati | 90 |

**Degli 81 non trovati su 90 il motivo era uno solo**: Venezia, Monza e Frosinone. In Football
Manager quelle squadre non sono in Serie A, perché il listone e il database del gioco sono
fotografie di momenti diversi.

### Le squadre che nel gioco non sono in Serie A

All'inizio quelle tre erano date per perse: «non è un difetto dell'abbinamento, è un dato da dire
all'utente». Era vero a metà. **Le squadre ci sono, semplicemente in un'altra divisione**, e si
possono andare a prendere per nome: due richieste per squadra, in blocco, dentro i vincoli di
ADR-0011.

Il primo tentativo era fallito per due filtri sbagliati in fila:

| Filtro | Perché non funzionava |
|---|---|
| `classification_id:=club` | Non è un valore esistente: le squadre hanno `type_id:=team` |
| Divisione «Italian Serie B» | Il nome vero è **«Serie BKT»**, col nome dello sponsor |

Due filtri sbagliati danno zero risultati, e zero risultati somigliano molto a «questa squadra non
c'è». È il motivo per cui la prima conclusione era sbagliata pur essendo ragionevole.

Adesso la squadra si cerca senza filtrare per divisione: si ordina per reputazione e si prende la
prima il cui nome, ridotto con la stessa chiave usata ovunque, coincide. Due condizioni si leggono
dai documenti invece che interpretare la divisione: **nazione Italia** — senza, «Inter» restituisce
l'Inter Miami — e **genere maschile**, perché le squadre femminili hanno lo stesso identico nome e
una reputazione alta.

| | Prima | Dopo |
|---|---|---|
| Abbinati | 444 su 531 | **521** |
| Con la foto caricata | 426 | **487 (92%)** |
| Dedotti dal solo cognome | 8 | **0** |
| Non trovati | 83 | **5** |
| Stemmi | 17 su 20 | **20 su 20** |

### Poi si è scoperto che il 92% era il 95%

L'utente ha detto una cosa che sembrava un'impressione e invece era un'osservazione: «molti dei
volti mancanti nel facepack ci sono». Aveva ragione, e dietro c'erano **tre difetti diversi**,
tutti nascosti dalla stessa frase, «manca la foto».

**Il limite di caricamento tagliava sempre la coda.** Il numero massimo di immagini valeva di
default «quanti hanno il file nel facepack», ma la fetta veniva presa sull'elenco degli
**abbinati**, che è più lungo: chi è abbinato e il file non ce l'ha occupava un posto senza
caricare niente. Ogni giro perdeva in fondo esattamente tanti volti quanti erano i senza file —
sempre gli ultimi, e a listone fermo sempre gli stessi. **Diciassette facce** sono rimaste fuori
così per tutta la vita dello script, e nessun conteggio lo diceva perché i due numeri, 504
disponibili e 487 caricati, comparivano in due righe diverse dell'output.

**Le abbreviazioni di più di una lettera.** Il listone scrive «Martinez Jo.» e «Pessina Mas.». Il
codice cercava un'iniziale di **una** lettera e tagliava le code fino a **due** caratteri: «Jo.»
non veniva riconosciuta come abbreviazione, «Mas.» restava attaccata al cognome. Adesso
l'abbreviazione si riconosce **dal punto**, non dalla lunghezza:

> Tagliare per lunghezza vuol dire scegliere un numero, e ogni numero sbaglia da una parte: a due
> lettere si perde «Pessina Mas.», a tre si perde il cognome di «Mario Rui». Il punto invece lo
> mette il listone apposta, ed è lì solo quando l'abbreviazione c'è davvero.

**I doppioni non sono ambiguità.** Piana e Ziółkowski risultavano ambigui perché nel gioco
compaiono **due volte**, stesso identico nome e due identificativi: capita ai ragazzi delle
giovanili appena saliti in prima squadra. Fra due copie della stessa persona si prende quella che
nel facepack ha la faccia; l'altra è una riga e basta.

| | Prima | Dopo |
|---|---|---|
| Abbinati | 521 su 531 | **525** |
| Con la foto caricata | 487 (92%) | **507 (95%)** |
| Ambigui | 5 | **2** |
| Non trovati | 5 | **4** |

### I ventiquattro che restano, divisi per motivo

«Manca la foto» nasconde situazioni che si risolvono in modi diversi, e metterle insieme fa
perdere tempo sul problema sbagliato. Per questo `scripts/volti-mancanti.mjs` le separa:

| Quanti | Situazione | Cosa si può fare |
|---|---|---|
| 18 | **Identificati**, ma quel volto nel facepack non esiste | Niente: nessuna regola di abbinamento fa comparire un file che non c'è. Sono tutti giovani con identificativo `2000…` |
| 2 | **Ambigui**: due persone plausibili, tutte e due col volto | Lo decide una persona |
| 4 | **Non trovati** con nessuna grafia | Lo decide una persona |

Per i sei che restano `scripts/volti-cerca.mjs` interroga fmref **una grafia alla volta**, solo su
chi è rimasto fuori, e dice se quella faccia nel facepack c'è. Resta dentro ADR-0011: una manciata
di richieste a tavolino, mai una durante l'asta. Non scrive niente — propone. La decisione si
registra con `volti.mjs --conferma "Terracciano=43017977"`, che può scrivere «confermata» perché
dietro c'è una persona che ha guardato, esattamente come in `--manuale`.

Lo zero della terza riga è il numero che conta più degli altri: ogni abbinamento rimasto nasce
dall'incrocio di cognome **e** squadra, che è il criterio affidabile. Nessuno resta appeso alla
fortuna di avere un cognome unico in tutta la Serie A.

Verificati venti abbinamenti a campione sulle tre squadre: venti su venti la persona giusta, casi
difficili compresi — «Adams A.» → Akor Adams, «Basic» → Toma Bašić, «Carboni A.» → Andrea Carboni.

### Due cache, non una

Le squadre recuperate stanno in `.cache/squadre-fuori-serie-a.json`, separate dall'elenco della
Serie A. Prima venivano aggiunte in coda a quello, e il primo script che riscaricava la Serie A
buttava via il lavoro dell'altro senza dire niente: se ne accorge solo chi va a rileggere la cache
e non ci trova più quello che ci aveva messo.

### Perché l'archivio è privato e gli indirizzi si firmano

Le immagini vengono da un facepack di terzi (ADR-0011, dichiarato e accettato). L'archivio `volti`
non è pubblico: le vede chi ha fatto l'accesso. Un tag `<img>` non manda intestazioni, quindi ogni
immagine ha bisogno di un indirizzo firmato; si firmano **tutti in una chiamata sola** all'apertura
del listone, con validità due ore, invece di quattrocento richieste.

### L'accesso con cui si carica

Lo script non chiede la password personale del proprietario. Si crea un account di servizio, gli dà
i permessi di amministrazione con la chiave di gestione che già usa per le migrazioni, e **lo
cancella appena finito**. Nessun segreto nuovo entra nel progetto.

## 2bis-bis. Quando l'automatico non basta

ADR-0011 lo prevedeva: «ciò che resta scoperto va nella schermata di abbinamento manuale, che serve
comunque». Sono due strumenti, e sono due perché il lavoro è di due tipi diversi.

### La schermata `/volti`, per chi amministra l'applicazione

Mostra **solo chi vale la pena guardare**, non i cinquecento del listone:

| Chi | Perché | Cosa si fa |
|---|---|---|
| Senza foto | Non si vede niente | Si carica un'immagine dal disco |
| Con volto **dedotto dal solo cognome** | Può essere la faccia di un altro | Si guarda e si dice «è lui» o «non è lui» |

Gli abbinamenti nati incrociando cognome **e** squadra non compaiono: sono affidabili, e metterceli
vorrebbe dire nascondere i novanta che contano dentro cinquecento che non contano.

Quello che si carica da qui nasce **confermato**: l'ha scelto una persona guardando, e nessun giro
automatico lo sovrascrive più. È la regola scritta nella migrazione 0022, ed è la ragione per cui
questa schermata vale la pena di esistere: senza, il lavoro di revisione andrebbe rifatto ogni
stagione e nessuno lo farebbe più di una volta.

«Non è lui» toglie anche l'identificativo di Football Manager, non solo l'immagine: se la faccia era
sbagliata lo era anche la persona, e lasciare l'identificativo vorrebbe dire ritrovarsi la stessa
faccia al giro successivo.

### `--proponi` e `--manuale`, dal terminale

Le immagini stanno nel facepack, sul disco: il browser non lo può leggere. Per passare in rassegna
novanta nomi pescando dal facepack serve lo script.

`--proponi` stampa chi resta fuori e i cinque nomi più somiglianti, con scritto se la foto nel
facepack c'è davvero. `--manuale` fa la stessa cosa e chiede, uno per uno, con un numero per
scegliere e invio per saltare.

La somiglianza è la distanza di Levenshtein normalizzata, più un premio se la squadra combacia e uno
piccolo alla reputazione. Serve a **proporre**, non a decidere: l'ordine dei candidati è solo un modo
di non far scorrere millesettecento nomi.

### Cinque abbinamenti recuperati guardando le proposte

Le proposte hanno mostrato un difetto dell'automatico: «Guðmundsson» e «Gudmundsson» sono la stessa
persona, ma la ð non è una d con un segno sopra — è una lettera a sé, e `normalize('NFD')` non la
tocca. Il nome giusto era il primo dei candidati proposti, e l'abbinamento automatico non ci
arrivava per una lettera.

Aggiunta una tabella per ð, þ, ø, œ, æ, ł, đ, ħ, ı, ß: **da 437 a 442 abbinati**, da 420 a 424 con
la foto. È il tipo di cosa che si vede solo guardando cosa il sistema propone quando sbaglia.

## 2bis-ter. Gli stemmi delle squadre

Lo stemma appartiene alla **squadra**, non ai suoi venticinque calciatori: sta in una tabella sua
(`club_logos`, chiave stagione + nome della squadra) e non in una colonna su `players`, dove
sarebbe ripetuto venticinque volte e andrebbe aggiornato in venticinque posti.

**Gli identificativi dei club non costano una richiesta.** Ogni calciatore scaricato porta la sua
squadra e l'identificativo di quella squadra: le venti squadre si ricavano contando. La squadra di
una riga del listone è quella che i suoi calciatori hanno più spesso — un criterio che non dipende
da come si chiama la società, ma da chi ci gioca, che è un dato più solido.

### Il difetto che gli stemmi hanno fatto emergere

Le prime venti squadre davano 16 stemmi su 20, e fra i mancanti c'era **l'Atalanta**, che in Serie A
c'è eccome. La causa non era il logopack: era `chiaveSquadra`, che riduceva i nomi in modo **non
simmetrico**.

| Nome | Prima | Perché |
|---|---|---|
| «Atalanta» (listone) | `atalanta bergamasca` | Finiva in una tabella di eccezioni |
| «Atalanta Bergamasca Calcio» (FM) | `bergamasca` | Non ci finiva, e si prendeva la parola più lunga |

Due chiavi diverse per la stessa squadra. Adesso il criterio è uno solo per entrambe le parti: fra
le parole significative si cerca un nome di squadra conosciuto, e quello è la chiave.

**Ha rimesso a posto anche le facce**, perché la stessa funzione serviva all'abbinamento dei
calciatori: da 442 a 444 abbinati, ma soprattutto i **dedotti dal solo cognome sono scesi da 34 a
8**. I calciatori dell'Atalanta prima si abbinavano per fortuna — cognome unico in tutta la Serie A
— e adesso si abbinano per squadra, che è il criterio affidabile.

Per questo `chiaveSquadra` sta ora in `scripts/lib/fm.mjs`, insieme a `normalizza`: due copie
che divergono vorrebbero dire le facce di una squadra e lo stemma di un'altra.

### Tre squadre restano senza

Venezia, Monza e Frosinone: in Football Manager non sono in Serie A, perché il listone caricato è di
un'annata diversa. Lo stesso motivo degli 81 calciatori senza faccia, e la stessa risposta: non è un
difetto da correggere, è un dato da dire.

## 2ter. L'esportazione, com'e' fatta

Fetta 6, costruita il 4 settembre 2026. Il formato e' quello di ADR-0008 e non si discute; quello
che si e' deciso qui e' il contorno.

**Si vede prima di scaricare.** Anteprima delle righe e avvertimenti — squadre incomplete, nomi con
caratteri che nei fogli danno noia — prima che il file esista. Un file che non si carica si scopre
dall'altra parte, a serata finita: il momento in cui l'errore costa poco e' prima.

**Il separatore si sceglie.** Le istruzioni ufficiali dicono quali colonne servono, non con che
carattere separarle. Il valore predefinito e' il punto e virgola, che e' quello che Excel in
italiano si aspetta; la virgola e' a un tocco, e la schermata dice quando provarla. Indovinare per
l'utente e sbagliare vorrebbe dire lasciarlo fermo senza sapere cosa tentare.

**I campi si proteggono secondo RFC 4180.** Prima o poi qualcuno chiamera' la sua squadra «Bomber;
il ritorno» per scherzo. Senza virgolette quel file si rompe in silenzio e sposta tutte le colonne
di uno: il portiere di uno diventa il prezzo di un altro. E' la prova a cui e' dedicata meta' della
verifica.

**C'e' il segno d'ordine dei byte.** Senza, Excel apre gli accenti come caratteri strani e chi
guarda pensa che il file sia sbagliato.

Resta vero quello che dice ADR-0008: **una specifica letta non e' un caricamento riuscito.** Il
formato va provato con un caricamento vero prima di dire che la fetta e' chiusa.

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
| 1.4 | 2026-09-03 | Chiarito che il listone è unico per tutti. Corretti gli script di verifica che lo cancellavano. |
| 1.3 | 2026-09-02 | Importazione realizzata: lettore di .xlsx e .csv scritto nel progetto, ADR-0012. Anteprima obbligatoria prima di scrivere. |
| 1.2 | 2026-09-02 | Ponte automatico tramite servizio pubblico di ricerca, ADR-0011. |
| 1.1 | 2026-09-02 | Facepack ispezionato con numeri reali, ponte deciso. Formato di esportazione fissato. |
| 1.0 | 2026-09-02 | Prima stesura. |
