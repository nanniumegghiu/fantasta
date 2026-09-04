# 04 · Frontend, design system e suoni

**Scopo** · Definire l'aspetto e il comportamento dell'interfaccia: colori, tipografia, animazioni,
suoni, e l'elenco completo delle schermate.
**Proprietario** · frontend-engineer
**Stato** · 🟡 token e componenti costruiti · quindici schermate fatte, **tutte provate tranne l asta in corso**
**Data** · 2026-09-02

---

## 1. Cosa fa

L'utente ha chiesto un'app «giovane e moderna, con colori accesi e bottoni animati». Questo
documento traduce quella frase in valori che si possono scrivere nel codice, e la vincola al logo
che è già in cartella, così che l'app e il marchio siano la stessa cosa.

## 2. Come funziona

### 2.1 La palette, presa dal logo

I colori non sono inventati: sono stati **estratti dai pixel di `brand/logo.png`** e sono i colori
dominanti reali del marchio.

| Nome | Valore | Uso |
|---|---|---|
| `--verde-notte` | `#082B1D` | Sfondo principale dell'app |
| `--verde-campo` | `#0E5739` | Superfici sollevate, schede, barre |
| `--verde-acceso` | `#449545` | Conferme, stati positivi, «obiettivo mio» |
| `--arancio` | `#F47918` | Azione principale: chiama, rilancia |
| `--arancio-caldo` | `#EB6517` | Stato premuto dell'arancio |
| `--oro` | `#F7C443` | Countdown, aggiudicazione, evidenze |
| `--oro-scuro` | `#D79426` | Bordi e ombre dell'oro |

Neutri: `--bianco #FFFFFF`, `--nebbia #E7EDE9`, `--fumo #9BB0A5`, `--carbone #0A1F16`.

Semantici: errore `#E5484D`, attenzione `--oro`, successo `--verde-acceso`, informazione `#3B9EFF`.

> **Tema scuro come predefinito.** Il logo nasce su fondo scuro e l'asta si fa la sera, spesso con
> un televisore acceso in una stanza in penombra. Il tema chiaro è previsto ma non prioritario.

### 2.2 Contrasto: il vincolo che i colori accesi mettono a rischio

Arancio e oro su fondo scuro funzionano; **testo bianco su arancio no**. Regola operativa: il testo
sopra `--arancio` e `--oro` è sempre `--carbone`, mai bianco. Ogni coppia colore-testo deve
raggiungere un rapporto di contrasto di almeno 4,5 a 1 per il testo normale e 3 a 1 per il testo
grande. 🟡 Da verificare con uno strumento di misura quando le schermate esisteranno: al momento è
una regola dichiarata, non ancora misurata.

### 2.3 Tipografia

Un carattere solo: **Inter**, scelto per le cifre a larghezza fissa che tengono fermo il countdown.
È geometrico, moderno e gratuito. I numeri dell'asta usano la variante a **cifre di larghezza fissa**, altrimenti il
countdown «balla» mentre scende da 10 a 9.

| Ruolo | Dimensione mobile | Dimensione schermo condiviso |
|---|---|---|
| Numero d'asta e countdown | 48 px | 180 px |
| Nome del calciatore in asta | 24 px | 96 px |
| Titolo di sezione | 20 px | 40 px |
| Testo corrente | 16 px | 28 px |
| Etichette e tabelle | 14 px | 24 px |

Lo schermo condiviso si guarda **da tre metri**: usa una scala tipografica sua, non quella del
telefono ingrandita.

### 2.4 Movimento

I bottoni animati devono aiutare, non distrarre.

| Elemento | Animazione | Durata |
|---|---|---|
| Bottone premuto | Scala a 0,96 e ombra che si accorcia | 120 ms |
| Rilancio accettato | Il numero sale con un rimbalzo corto | 240 ms |
| Nuova chiamata | La scheda del calciatore entra dal basso con una leggera rotazione | 320 ms |
| Countdown | Pulsazione a ogni secondo, il colore vira dall'oro al rosso sotto i 3 secondi | 1 s per ciclo |
| Aggiudicazione | 🔴 **Non costruita.** Coriandoli brevi e il nome della squadra che ingrandisce | 900 ms |
| Cambio di schermata | 🔴 **Non costruita.** Dissolvenza con scorrimento di 8 px | 180 ms |

> **Questa tabella descriveva due animazioni che non esistevano**, ed è l'errore che la regola 6
> del manuale chiama il più grave del progetto. Trovate dal ciclo 1 della Fetta 8, marcate qui, e
> in attesa di essere costruite: [il rapporto](qa/2026-09-04-asta-grafica-e-animazioni.md).
>
> Nella stessa occasione è emerso che **`AnimatePresence` non è usato in nessun file**: le entrate
> sono curate, le uscite non esistono, e ogni cambiamento è uno scatto.

**Rispetto delle preferenze di sistema.** 🟡 **Rispettato a metà.** Chi ha attivato la riduzione del
movimento riceve le stesse informazioni senza animazioni: nessun rimbalzo, nessun coriandolo, solo
cambi di stato immediati.

La regola in `styles/index.css` azzera le durate **CSS**, ma le animazioni di `motion/react` sono
pilotate da JavaScript e quella regola non le tocca: con «Riduci movimento» attivo il countdown
continua a pulsare all'infinito. `useReducedMotion` non è usato da nessuna parte. Va risolto in un
punto solo, non animazione per animazione. Non è un dettaglio di gentilezza, è che le animazioni pulsanti
possono dare fastidio fisico a chi soffre di emicrania vestibolare.

### 2.5 Suoni

Solo sullo **schermo condiviso**. I telefoni restano muti: dieci telefoni che suonano insieme in
una stanza sono rumore, non informazione.

| Evento | Suono | Perché |
|---|---|---|
| Nuova chiamata | Fischietto corto | Fa alzare la testa a tutti |
| Rilancio | Tocco secco, tono che sale con l'importo | Si sente che il prezzo cresce |
| Partenza countdown | Tre note discendenti | Segnala che si sta chiudendo |
| Ultimi 3 secondi | Battito al secondo | Tensione |
| Aggiudicazione | Martelletto e coro breve | Chiude il momento |
| Reparto completato | Campanella | Segna il passaggio di fase |

> ⚠️ **Il vincolo tecnico da conoscere subito.** Nessun browser lascia partire un suono prima che
> l'utente abbia toccato la pagina. Lo schermo condiviso si apre quindi su una schermata «Tocca per
> attivare l'audio» con il logo grande: un tocco solo, all'inizio della serata, e per il resto
> l'audio funziona. Se non lo prevedessimo, i suoni semplicemente non partirebbero e sembrerebbe un
> difetto.

Il volume è regolabile e i suoni si possono spegnere del tutto dallo schermo condiviso.

### 2.6 Le schermate

**Accesso**

1. Accesso con Google oppure email e password.
2. Registrazione con nome mostrato.
3. Recupero password.

**Fuori dalla lega**

4. Le mie leghe: elenco delle leghe di cui sono membro o creatore, con lo stato di ciascuna.
5. Crea lega: nome, stagione, regole, caricamento del PDF del regolamento.
6. Entra in lega con il codice di invito.

**Dentro la lega**

7. Riepilogo lega: partecipanti, regole, regolamento in PDF, stato dell'asta.
8. La mia squadra: nome, rosa divisa per ruolo, crediti, spesa per reparto.
9. Rose degli avversari: tutte le squadre con crediti residui aggiornati.
10. Listone: tabella filtrabile per ruolo e squadra, ordinabile per ogni statistica, con foto.

    Mostra **una stagione sola**: quella corrente se c'è, altrimenti la più popolata. Prima
    mescolava tutte le stagioni presenti nel database, comprese quelle finte delle prove
    automatiche, e chi apriva la pagina vedeva «P1 Prova» in mezzo ai calciatori veri.

    Lo **stemma** della squadra sta accanto al nome della squadra. Quando manca non lascia un
    segnaposto: il nome è scritto lì di fianco, e un quadrato grigio aggiungerebbe rumore senza
    aggiungere niente. È il contrario della scelta fatta per i volti, e per un motivo preciso: lì
    la mancanza lascerebbe un buco in una riga fatta di immagini, qui no.

    Il **volto** del calciatore, quando c'è, sta accanto al nome. Quando non c'è ci sono le
    iniziali sul colore del ruolo: un quarto dei calciatori non ha la foto e ce ne saranno sempre,
    quindi la ricaduta non è un caso limite ma metà del disegno. Vale anche quando l'immagine
    esiste ma non arriva.

    La prima colonna è il **ruolo**, come pastiglia colorata. Si ordina per reparto, P D C A, che è
    l'ordine in cui si gioca l'asta: l'ordine alfabetico dei codici non vuol dire niente. A parità
    di colonna le righe si dispongono per nome, altrimenti dentro un reparto l'ordine sarebbe
    quello in cui il listone è arrivato, cioè nessuno.
11. **Lista obiettivi**, la schermata più ricca. Si apre sulla **scelta del metodo**, fasce oppure
    slot, spiegata con due schede invece che con degli interruttori. Scelto il metodo, si lavora
    dentro quello: i calciatori si aggiungono **dal posto in cui devono finire**, toccando la fascia
    o lo slot, e si riordinano trascinando. Il tetto di spesa e l'incrocio portieri si accendono
    quando servono; la nota c'è sempre.

    **Gli slot sono i posti del regolamento.** Tanti quanti la lega ne prevede, tre portieri, otto
    difensori, otto centrocampisti, sei attaccanti. Non se ne aggiungono e non se ne tolgono: si
    cambia il nome, perché è quello che ti ricorda che ruolo ha quel posto nella tua idea di squadra.
    Il tetto di spesa, in questo metodo, sta **sul posto e non sul nome**: dentro uno slot i
    candidati valgono la stessa cosa, ed è il motivo per cui li hai messi insieme. Nel riepilogo la
    somma dei massimali è quindi il piano di spesa vero, non una stima per eccesso: se sfora i
    crediti, il piano non regge, e la schermata lo dice con parole diverse da quelle delle fasce.

    **La pagina è viva durante l'asta**, sullo stesso canale dell'asta stessa, e **nasconde i
    calciatori che qualcuno ha già comprato**: si vede solo quello che si può ancora prendere. Non
    si cancella niente dal database, e una riga dice quanti sono spariti e da chi sono stati presi,
    con un tocco per riguardarli. Sparire in silenzio lascerebbe il dubbio di aver perso una riga
    per un difetto. Insieme agli obiettivi spariscono i legami che li nominano, altrimenti uno slot
    risulterebbe «coperto» da un candidato appena finito nella rosa di un altro.

    Fasce e slot sono **divisi per reparto**, e in cima c'è un filtro che ne lascia vedere uno solo.
    Scegliendo i nomi per una fascia di difensori non compaiono gli attaccanti: non è un aiuto alla
    ricerca, è la regola del modello, e il server la fa rispettare comunque.

    Il reparto scelto vive **nell'indirizzo** (`?ruolo=D`), non nello stato del componente. Così la
    vista personale dell'asta ci porta già filtrata sul reparto che si sta chiamando, e il
    collegamento si può rimettere fra i preferiti.
12. Impostazioni lega, solo amministratore: regole, partecipanti, codice di invito, apertura asta.

**Asta**

**La freccia indietro torna da dove si veniva.** Non «un piano più su»: durante un'asta si esce di
continuo per un secondo — guardo un obiettivo, controllo il listone, torno — e una destinazione fissa
riportava alla schermata della lega, con tre tocchi per rientrare e magari una chiamata persa.
`Intestazione` usa la cronologia quando c'è, e la destinazione fissa solo quando non c'è: cioè
arrivando da un collegamento esterno o riaprendo l'app su quella schermata.

13. Vista personale dell'asta: calciatore in asta, mie informazioni su di lui, rilanci +1, +5, +10
    e libero, crediti, obiettivi residui, accesso rapido a rose e listone. La scorciatoia agli
    obiettivi porta al **solo reparto in corso** e lo dice nel nome: «I miei difensori».

    **La mia rosa è sempre aperta**, con i calciatori presi, il prezzo pagato e i posti vuoti
    tratteggiati. I contatori da soli dicono quanto manca, non chi ho già preso, ed è il secondo
    dato che serve mentre si rilancia.

    **Le rose degli avversari si aprono toccandole**, una alla volta. Aperte tutte insieme sarebbero
    duecento righe fra chi guarda e il pulsante per rilanciare; chiuse del tutto costringerebbero a
    cambiare schermata proprio nel momento in cui servono.
14. Vista amministratore dell'asta: la precedente più i poteri di conduzione, su **due piani**.

    Fra i comandi del secondo piano c'è **Correggi le rose**: si sceglie un calciatore già comprato,
    da qualunque squadra, e lo si toglie o gli si cambia il prezzo. Il campo del motivo è
    obbligatorio e la schermata dice **prima**, non dopo, che finirà nel registro che vedono tutti.

    Sopra, sempre visibile, **solo l'azione del momento**: aggiudicare quando c'è un'offerta,
    passare quando non c'è nessuno, estrarre quando non c'è nessuno in asta. Una alla volta, ed è
    quella che serve adesso.

    Sotto, **a scomparsa**, tutto il resto: pausa, assegnazione senza asta, riempimento per nome,
    annullamento, chiusura. Chi conduce è anche uno che gioca, e prima la sua asta finiva
    schiacciata sotto pulsanti che servono tre volte in una serata. Nascondere anche l'azione del
    momento sarebbe stato più pulito da guardare e peggio da usare: costringerebbe ad aprire un
    pannello ogni volta che la stanza aspetta una decisione.
15. **Schermo condiviso**: la vista da proiettare, senza comandi, con i suoni.

    Si apre in due modi, e il disegno è **lo stesso componente**: dalla sessione di un partecipante,
    che ascolta il canale in tempo reale, oppure dal **codice della TV** (`/tv/K7M2PQ`), che
    interroga ogni secondo e mezzo senza nessun accesso. Due copie della stessa schermata
    divergerebbero al primo ritocco, e ce ne si accorgerebbe la sera dell'asta guardando due
    televisori diversi.

    Il codice è di sei caratteri senza O, 0, I e 1: si digita col telecomando, dove quei quattro
    caratteri si sbagliano sempre. Nel pannello di conduzione l'indirizzo è scritto su due righe,
    con il codice staccato e spaziato, perché chi digita alterna lo sguardo fra telefono e
    televisore e la parte che si sbaglia è quella.

    Disposizione richiesta dall'utente, in due fasce orizzontali.

    **Fascia superiore, il momento presente.** A sinistra il calciatore chiamato con la cifra
    dell'offerta corrente in caratteri enormi e il nome di chi l'ha fatta. A destra le sue
    statistiche di campionato, con la giornata di riferimento. Il countdown occupa il centro
    quando parte.

    **Fascia inferiore, le rose per intero.** Tutte le squadre affiancate, una colonna a testa,
    con la **rosa completa e il prezzo pagato per ogni calciatore**. I crediti stanno in cima alla
    colonna e non si muovono: sono il dato che si guarda più spesso e da più lontano.

    I contatori da soli — «D 5/8» — dicono quanto manca, non cosa c'è. La domanda vera durante
    un'asta è chi ha già preso il portiere del Milan, e a quanto: senza quel dato non si capisce se
    chi rilancia sta completando un reparto o togliendosi uno sfizio, e si offre alla cieca.

    Gli slot ancora vuoti si vedono tratteggiati. Sono la cosa che a fine serata conta di più, e
    tenendo il numero di righe costante la fascia non cambia altezza mano a mano che le rose si
    riempiono: su un televisore vorrebbe dire un layout che balla tutta la sera.

    Accanto ai crediti restano il massimo ancora offribile e la spesa fatta finora. È il riepilogo
    totale dell'asta, e resta sempre visibile mentre sopra si svolge la chiamata.

    Il senso della divisione: chi guarda da tre metri deve capire in un colpo d'occhio *cosa sta
    succedendo adesso* e *come sta andando la serata*, senza che nessuno debba cambiare schermata.
15bis. **Registro dell'asta**, in fondo alla vista personale e visibile a **tutti**, non solo a chi
    conduce. Si apre sui soli interventi manuali, perché il gioco normale — chiamate, rilanci,
    aggiudicazioni — è la maggioranza e annegherebbe le poche righe che contano; «tutta la serata» è
    a un tocco. Ogni intervento porta il motivo scritto da chi l'ha fatto e il suo nome.

15ter. **Scambi**, nella schermata della lega e solo se la lega li ha abilitati. Si sceglie
    l'avversario, si spuntano i calciatori da una parte e dall'altra, e **il conto dei reparti si
    vede mentre si sceglie**: il pulsante resta spento finché non pareggiano. La regola la fa
    rispettare il server comunque, ma impararla da un rifiuto dopo aver composto tutto vorrebbe
    dire comporre la proposta due volte.

    Le proposte si raccontano sempre dal punto di vista di chi guarda — «dai» e «prendi», non «la
    squadra A dà alla squadra B» — perché con sei squadre in lega capire da che parte si sta
    richiede un attimo di troppo mentre si decide.

15quater. **Revisione dei volti** (`/volti`, solo per chi amministra l'applicazione). Si arriva
    dall'icona nell'intestazione del listone, perché è guardando il listone che ci si accorge di una
    faccia sbagliata: un collegamento altrove andrebbe ricordato proprio quando serve.

    Tiene separati i due lavori — «manca la foto» si risolve caricando, «c'è ma è dedotta» si
    risolve guardando — perché sono due gesti con due rischi diversi. A chi non amministra la
    schermata dice che non deve fare niente, invece di mostrargli comandi che fallirebbero.

16. Fine asta: riepilogo ed esportazione in CSV.

### 2.7 Struttura mobile

Si progetta a **360 px** e si sale. Barra di navigazione in basso con cinque voci: Asta, Rosa,
Listone, Obiettivi, Lega. Durante l'asta la barra resta sempre raggiungibile con il pollice, perché
l'utente ha chiesto esplicitamente di poter controllare rose e listone «in qualsiasi momento» senza
perdere l'asta: qualunque schermata si stia guardando, una fascia fissa in alto mostra chi è in asta
e a quanto, e riporta indietro con un tocco.

Punti di rottura: 360, 768 tablet, 1024 desktop, 1440 e oltre per lo schermo condiviso.

Area di tocco minima 44 x 44 px. I bottoni di rilancio sono più grandi: si premono di fretta.

## 3. File coinvolti

| File | Cosa contiene |
|---|---|
| `app/src/styles/index.css` | I token, presi dal logo, e le regole di base |
| `app/src/components/` | Bottone, Campo, CampoNumero, Interruttore, Intestazione, MarchioFantasta |
| `app/src/pages/` | Le schermate realizzate |
| `app/public/sounds/` | 🔴 non esiste ancora: i suoni arrivano con la Fetta 4b |

Il nome scritto **Fantasta** vive in un componente solo, `MarchioFantasta`: «Fant» in bianco e
«asta» in arancione, così la parola ASTA emerge dentro il nome. Scriverlo a mano nelle schermate
porterebbe prima o poi a tagliarlo nel punto sbagliato.

## 4. Decisioni e perché

- **Palette dal logo, non a piacere.** Il marchio esiste già: l'app deve sembrarne la continuazione.
- **Suoni solo sullo schermo condiviso.** Vedi sopra: è una scelta di comfort in una stanza reale.
- **Tema scuro predefinito.** Contesto d'uso serale e coerenza col logo.
- **Scala tipografica doppia.** Un'interfaccia leggibile a 30 cm non lo è a 3 metri.

## Da sapere prima di intervenire

**Aprire non è scrivere.** Un pulsante che porta a una schermata di scelta non deve cambiare niente
sul server: cambia solo il pulsante che conferma. Se cambia prima, chi preme «annulla» si ritrova
una modifica che non ha voluto e l'etichetta del pulsante diventa una bugia. Ed è la stessa ragione
per cui da una schermata di scelta si deve sempre poter uscire senza scegliere.

**La trappola dei campi password.** Il gestore delle password del browser riempie da solo i campi
che gli sembrano di accesso, e lo fa anche in una registrazione nuova: l'utente si trova il campo
già pieno di caratteri che non ha mai digitato e deve cancellarli. Perché non succeda servono tre
cose insieme:

1. un attributo **nome** esplicito e diverso su ogni campo, perché il browser decide cosa riempire
   guardando quello;
2. `autocomplete` impostato a **nuova password** nei moduli di registrazione;
3. il campo va **ricreato da zero** quando si passa da accesso a registrazione, altrimenti resta in
   pagina quello di prima con dentro quello che il browser ci aveva scritto.

**Ogni campo password di registrazione ha la sua conferma.** Un errore di battitura su una password
che non si vede lascia la persona chiusa fuori dal proprio account, e senza recupero via email non
c'è modo di rientrare. La conferma non è una formalità, è l'unica rete.

I nomi dei calciatori italiani sono lunghi e le squadre pure. Ogni componente va provato con il nome
più lungo del listone, non con «Kean». I testi in italiano sono mediamente il 20% più lunghi degli
equivalenti inglesi: le etichette dei bottoni vanno verificate a 360 px.

## Aperto / TODO

- ✅ Carattere scelto: **Inter**, per le cifre a larghezza fissa che tengono fermo il countdown.
  Caricato da servizio esterno con ricaduta sui caratteri di sistema. Vedi
  `docs/componenti/app-web.md` per il dubbio ancora aperto sul portarlo dentro il progetto.
- ✅ Suoni: sintetizzati nel browser, senza nessun file audio da reperire o licenziare.
- 🟡 Contrasto dichiarato ma non ancora misurato.
- 🟡 Tema chiaro: previsto, non progettato.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.14 | 2026-09-04 | Due animazioni promesse da questo documento e mai costruite, marcate 🔴. Il movimento ridotto è rispettato a metà. |
| 1.13 | 2026-09-04 | Lo schermo condiviso si apre anche da un codice di sei caratteri, per il televisore. |
| 1.12 | 2026-09-04 | Stemmi delle squadre nel listone, nell asta e sullo schermo condiviso. |
| 1.11 | 2026-09-04 | Schermata di revisione dei volti, con i due lavori tenuti separati. |
| 1.10 | 2026-09-04 | Scambi fra squadre, con il conto dei reparti che si vede mentre si sceglie. |
| 1.9 | 2026-09-04 | I volti dei calciatori nel listone, nell asta e sullo schermo condiviso. |
| 1.8 | 2026-09-03 | Correzione delle rose con motivo obbligatorio, e registro dell asta visibile a tutti. |
| 1.7 | 2026-09-03 | Rose nella vista personale, obiettivi vivi senza i calciatori gia comprati, freccia indietro che torna da dove si veniva. |
| 1.6 | 2026-09-03 | Schermo condiviso con le rose intere e i prezzi. Comandi di conduzione a due piani, con il secondo a scomparsa. |
| 1.5 | 2026-09-03 | Colonna del ruolo nel listone. Gli slot sono i posti del regolamento, con un massimale a testa. Tutte le schermate provate tranne l asta in corso. |
| 1.4 | 2026-09-03 | Obiettivi divisi per reparto, con il filtro del reparto in corso. |
| 1.3 | 2026-09-02 | Vista personale dell asta e schermo condiviso. Suoni sintetizzati invece che da file. |
| 1.2 | 2026-09-02 | Schermate di listone, importazione e lista obiettivi. |
| 1.1 | 2026-09-02 | Carattere scelto, marchio diviso in due colori, primi componenti e schermate. |
| 1.0 | 2026-09-02 | Prima stesura, palette estratta dal logo reale. |
