# 08 · Roadmap

**Scopo** · Stabilire in che ordine si costruisce, con l'unica regola che conta: ogni fetta deve
finire in qualcosa che si può **mostrare e usare**, non in uno strato invisibile.
**Proprietario** · project-manager
**Stato** · 🟡 Fette da 0 a 7 costruite e verificate una per una. Resta la Fetta 8, e resta la
prova che nessuna verifica sostituisce: **un asta vera, in movimento, con piu di un dispositivo**.
**Data** · 2026-09-04

---

## 1. Cosa fa

Divide il lavoro in fette verticali. Una fetta orizzontale sarebbe «facciamo tutto il database»:
alla fine non si vede niente e non si sa se funziona. Una fetta verticale attraversa tutti gli
strati e produce una cosa che si accende.

## 2. Le fette

### Vincolo di calendario: chiarito

L'asta è a più di sei settimane di distanza. Nessuna pressione: si segue l'ordine intero, facepack
compreso, e si chiude con la revisione iper-critica prima di usare l'app sul serio.

---

### Fetta 0 · Fondamenta — 🟡 costruita, con un buco dichiarato

Progetto creato, backend attivo, accesso funzionante, pubblicazione online.

**Si dimostra così**: mi registro con Google da telefono, entro, vedo una pagina «Le mie leghe»
vuota col mio nome, esco e rientro.

| Pezzo | Stato |
|---|---|
| Progetto web che compila, con icone e installabilità | ✅ verificato: compilazione e server di anteprima |
| Progetto Supabase creato e attivo | ✅ verificato |
| Migrazione dei profili applicata, con policy attive | ✅ verificato interrogando lo schema |
| Regole di accesso provate violandole | ✅ 7 prove su 7 superate |
| Registrazione e accesso con email | ✅ verificati via richieste reali |
| Schermate viste in un browser | ✅ aperte e provate dall utente il 3 settembre 2026 |
| Accesso con Google | ✅ provider acceso, tasto verificato sul sito pubblicato |
| Pubblicazione online | ✅ https://nanniumegghiu.github.io/fantasta |
| **Recupero della password** | 🔴 **non esiste**: vedi qui sotto |

**Il buco, scritto perche' non si dimentichi.** Non c'e' nessun «password dimenticata», nessun
recupero, nessun cambio password. Chi si e' registrato con email e password e la perde **resta
fuori per sempre**, e l'amministratore non puo' aiutarlo: nel database non c'e' niente da
premere. Con l'accesso Google il caso e' piu' raro, non impossibile.

E' la stessa regola che l'asta chiusa per sbaglio ha gia' insegnato — *ogni porta che si chiude
deve avere la maniglia dall'altro lato, nel posto dove ti accorgi che e' chiusa* — e qui la
maniglia non c'e'. **Messo da parte per scelta dell'utente il 4 settembre 2026**, non per
dimenticanza: resta 🔴 finche' non esiste.

### Fetta 1 · Leghe, inviti e squadre — ✅ costruita e provata

Creazione lega con tutte le regole, caricamento del PDF del regolamento, codice di invito
condivisibile su WhatsApp, ingresso in lega, creazione della propria squadra con nome.

**Si dimostra così**: da un telefono creo la lega, mando il codice su WhatsApp a un secondo
dispositivo, che entra e crea la sua squadra. Entrambi vediamo l'elenco dei partecipanti aggiornato.

| Pezzo | Stato |
|---|---|
| Tabelle, policy, funzioni di creazione e ingresso | ✅ 30 prove su 30, `node scripts/verifica-leghe.mjs` |
| Codice di invito, rigenerazione, limite ai tentativi | ✅ verificato |
| Regolamento in PDF, archivio privato con indirizzi firmati | ✅ verificato |
| Schermate: elenco leghe, creazione, ingresso, riepilogo | ✅ aperte e provate dall utente |
| Prova vera su due dispositivi | 🔴 |

### Fetta 2 · Listone e statistiche — ✅ costruita e provata

Importazione del listone, importazione delle statistiche, tabella con filtri per ruolo e squadra e
ordinamento su ogni colonna.

**Si dimostra così**: su un telefono, filtro i centrocampisti del Napoli ordinati per media voto, e
lo scorrimento è fluido con tutte le righe caricate.

| Pezzo | Stato |
|---|---|
| Lettore di file .xlsx e .csv, senza dipendenze | ✅ 17 prove, `node --experimental-strip-types scripts/verifica-listone.mjs` |
| Riconoscimento delle colonne, righe scartate con il motivo | ✅ verificato |
| Importazione ripetibile, chi sparisce viene ritirato e non cancellato | ✅ verificato |
| Tabella con filtri per ruolo e squadra e ordinamento su ogni colonna | ✅ aperta e provata dall utente |
| Colonna del ruolo, ordinabile per reparto | ✅ P D C A, non in ordine alfabetico |
| Prova sul file ufficiale vero | 🔴 serve il file |

### Fetta 3 · Lista obiettivi — 🟡 costruita, poi rifatta dopo la prova d uso

I quattro metodi richiesti, tutti facoltativi e combinabili: fasce, tetto di spesa, slot della rosa
ideale, incrocio portieri. Note libere per calciatore.

**Si dimostra così**: costruisco una lista con tre fasce, metto i tetti, definisco sei slot in
attacco con i candidati, creo un incrocio fra due portieri. Da un altro account, la stessa lista è
**invisibile**.

| Pezzo | Stato |
|---|---|
| Tabelle e policy dei quattro metodi | ✅ 24 prove su 24, `node scripts/verifica-obiettivi.mjs` |
| Invisibilità agli altri, **amministratore compreso** | ✅ sette prove distinte, tutte a zero righe |
| Schermata con fasce, tetti, note, slot e incroci | ✅ aperta e provata dall utente |
| Contatore degli obiettivi ancora liberi durante l'asta | 🔴 arriva con la Fetta 4f |
| Rifatta dopo la prova d uso: un metodo solo, aggiunte dal posto giusto, riordino trascinando | ✅ 34 prove |
| Fasce e slot **divisi per reparto**, con il filtro che nasconde gli altri tre | ✅ 44 prove, `node scripts/verifica-obiettivi.mjs` |
| Slot: quantità dal regolamento, nome modificabile, **un massimale per posto** | ✅ 8 prove dedicate, comprese quelle che provano a violare la regola |

### Fetta 4 · L'asta — ✅ costruita, 🟡 provata una prima volta e corretta

È il cuore dell'app e il pezzo più difficile. Va spezzata.
| Sotto-fetta | Stato |
|---|---|
| **4a · Motore** | ✅ 26 prove, `node scripts/verifica-asta.mjs` |
| **4b · Schermo condiviso** | 🟡 provato, poi rifatto: rose intere con i prezzi, crediti sempre in cima |
| **4c · Varianti** | ✅ tutte e sette, più la modalità live |
| **4d · Poteri amministratore** | ✅ passa, assegna, aggiudica, annulla, pausa |
| **4e · Chiamata con passo** | ✅ irreversibile, chiude in anticipo quando resta uno solo |
| **4f · Aggancio obiettivi** | ✅ tetto e nota del calciatore in asta, nella vista personale; la scorciatoia apre gli obiettivi sul reparto in corso |
| Rete di sicurezza sui lotti dimenticati | ✅ pianificata ogni dieci secondi |
| Prova su dispositivi veri | 🟡 prima asta provata con compagni finti, quattro difetti trovati e corretti |
| La catena dei lotti si apre da sola | ✅ dopo aggiudicazioni e passaggi, nei metodi a estrazione |
| Riempimento finale: si rimette all asta un nome cercato | ✅ 11 prove |
| Correzione delle rose e dei prezzi, con registro visibile a tutti | ✅ 12 prove |
| Rose proprie e altrui nella vista personale | ✅ 2 prove su chi puo vederle |
| Obiettivi vivi: spariscono i calciatori gia comprati | ✅ sullo stesso canale dell asta |

| Sotto-fetta | Contenuto | Come si dimostra |
|---|---|---|
| **4a · Motore** | Impostazioni pre-asta, apertura, chiamata, offerte, timer del server, aggiudicazione. Solo metodo a chiamata libera totale, solo vista personale. | Due telefoni si rilanciano davvero; il countdown scade e il calciatore viene assegnato; i crediti scalano. |
| **4b · Schermo condiviso** | La pagina da proiettare, con i suoni e il massimo spendibile di ognuno. | Il televisore mostra la chiamata e fa il rumore giusto quando qualcuno rilancia. |
| **4c · Varianti** | Chiamata per ruoli e ibrida, asta alfabetica, asta random, con e senza divisione per ruolo. | Si apre un'asta per ognuna delle sette combinazioni e si verifica il comportamento. |
| **4d · Poteri amministratore** | Passa, assegnazione rapida, annulla ultima aggiudicazione, pausa. | L'amministratore passa un calciatore e ne assegna un altro senza asta. |
| **4e · Chiamata con passo** | Esclusione dai rilanci, chiusura anticipata. | Tutti passano tranne uno e il lotto si chiude subito. |
| **4f · Integrazione obiettivi** | Durante l'asta la lista mostra solo gli obiettivi liberi, col contatore; il calciatore in asta mostra le mie note e il mio tetto. | Chiamo un mio obiettivo e vedo il tetto che mi ero dato. |

### Fetta 5 · Facepack — ✅ costruita e completa

| Pezzo | Stato |
|---|---|
| Ponte automatico verso gli identificativi di Football Manager | ✅ 525 abbinati su 531 |
| Immagini caricate nell archivio | ✅ **507 su 531, il 95%**, indirizzi firmati a blocchi |
| Chi resta fuori, e perche' | ✅ 18 identificati che nel facepack non ci sono, 6 da chiedere a una persona |
| Volti nel listone, nell asta e sullo schermo condiviso | ✅ con ricaduta sulle iniziali |
| Schermata di abbinamento manuale | ✅ `/volti`, più `--proponi` e `--manuale` dal terminale |
| Loghi delle squadre | ✅ 20 su 20, comprese quelle che nel gioco giocano in Serie B |

*Descrizione originale della fetta:*

Caricamento in blocco, associazione automatica, schermata di abbinamento manuale per il resto, foto
nel listone e nelle rose.

### Fetta 6 · Fine asta ed esportazione — ✅ costruita, 🟡 mai passata dal sito vero

| Pezzo | Stato |
|---|---|
| Rilevamento rose complete e chiusura automatica | ✅ provato dentro `verifica-asta.mjs` |
| Esportazione CSV, propria rosa o tutte | ✅ 14 prove, `verifica-esportazione.mjs` |
| Quattro colonne come le istruzioni ufficiali | ✅ ADR-0008 |
| **Il file caricato davvero nell app Fantacalcio** | 🔴 **mai fatto** |

La differenza fra le prime tre righe e la quarta e' tutta la differenza che conta. Le prove
verificano che il file sia **come abbiamo deciso che dev'essere**; solo il caricamento vero
verifica che sia **come lo vuole chi lo legge**. E' l'ultimissimo passo dell'intera applicazione:
un formato sbagliato si scopre la sera in cui serve.

### Fetta 7 · Scambi — ✅ costruita e provata

| Pezzo | Stato |
|---|---|
| Proposta, accettazione, rifiuto | ✅ 20 prove, `verifica-scambi.mjs` |
| I reparti devono pareggiare | ✅ la regola che tiene in piedi le rose |
| Rivalidazione al momento dell accettazione | ✅ una rosa cambiata nel frattempo non passa |

### Fetta 8 · Revisione iper-critica — 🟡 ciclo 1 svolto, in attesa di decisione

Applicazione di `Metodo-QA-Testing-Iper-Critico.md` sull'app funzionante, un percorso per volta,
partendo dall'asta. **Con attenzione dichiarata alla grafica e alle animazioni**: l'utente le ha
giudicate scarne, e «funziona» non è la stessa cosa di «è viva».

| Ciclo | Percorso | Esito |
|---|---|---|
| 1 | L'asta viva: schermo condiviso e dispositivo personale | ✅ svolto · 4 red flag, 6 proposte, 5 approvate · [rapporto](qa/2026-09-04-asta-grafica-e-animazioni.md) |
| 1b | Le cinque proposte approvate, più sette correzioni chieste dall'utente | ✅ costruite e provate · 28+54+8 prove verdi |
| 2 | Preparazione: leghe, listone, obiettivi | 🔴 non iniziato |

**Il ciclo 1 non ha toccato una riga di codice**, come il metodo impone: le decisioni si prendono
insieme prima di scrivere. La scoperta che pesa di più è che due righe della tabella delle
animazioni in `04-frontend-e-design.md` erano **scritte e mai costruite** — l'aggiudicazione con i
coriandoli e la transizione fra schermate — e che `AnimatePresence` non è usato da nessuna parte,
quindi nell'app **niente esce mai di scena**. È la ragione tecnica della sensazione di «scarno».

---

## 3. Cosa resta fuori, dichiarato

Non sono previsti, e non vanno costruiti di nascosto: gestione delle formazioni settimanali, calcolo
dei punteggi di giornata, classifica del campionato, mercato di riparazione, chat interna, pagine
legali. L'app finisce quando le rose sono fatte ed esportate.

## 4. Decisioni e perché

- **L'asta è al centro ma non è la prima fetta.** Senza listone e senza squadre non c'è niente da
  mettere all'asta. L'ordine è imposto dalle dipendenze, non dall'entusiasmo.
- **La fetta 4 è spezzata in sei.** Costruirla in un blocco solo significherebbe settimane senza
  niente da mostrare, che è il modo migliore per accorgersi tardi di un errore di fondo.

## Da sapere prima di intervenire

Ogni fetta si chiude con una **verifica mostrata**, non con un «fatto». La colonna «come si dimostra»
non è decorativa: è il criterio di chiusura.

## Aperto / TODO

- 🔴 **Recupero della password: non esiste.** Messo da parte per scelta, non per svista. Vedi Fetta 0.
- 🔴 **Il CSV delle rose non è mai stato caricato nell'app Fantacalcio.** Vedi Fetta 6.
- 🟡 **Un'asta vera, in movimento.** Gli avversari automatici esistono e sono provati
  (`bot-asta.mjs`, 17 prove): rilanciano da soli, si fermano al loro limite, e non possono fare
  niente che una persona non possa fare. Manca la serata vera, con lo schermo sul televisore.
- 🟡 **Fetta 8**, iniziata, con la grafica e le animazioni fra gli oggetti dell'esame.
- 🟡 Una prova di `verifica-asta-completa.mjs` è fallita **una volta sola** e non si è più
  riprodotta in tre rilanci. Lasciata dichiarata come irrisolta invece che fatta sparire.
- ✅ Pubblicazione online: https://nanniumegghiu.github.io/fantasta, ricompilata a ogni push.
- ✅ Il listone vero è caricato: 531 calciatori 2026/27, con statistiche, volti e stemmi.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.21 | 2026-09-05 | Costruito quello che il ciclo 1 aveva approvato, più sette correzioni emerse usando l app. |
| 1.20 | 2026-09-04 | Fetta 8, ciclo 1: l asta viva passata al setaccio. Nessun codice toccato, come impone il metodo. |
| 1.19 | 2026-09-04 | Avversari automatici per provare l asta da soli, e i tre difetti che la loro prima prova ha fatto uscire. |
| 1.18 | 2026-09-04 | Stato riallineato al codice: fette 6 e 7 chiuse, Google e pubblicazione fatte, e tre buchi scritti come tali — password, CSV mai caricato, asta mai vissuta. |
| 1.17 | 2026-09-04 | Le squadre fuori Serie A si cercano per nome: 92% dei volti e tutti gli stemmi. |
| 1.16 | 2026-09-04 | Stemmi delle squadre, e la chiave dei nomi resa simmetrica. |
| 1.15 | 2026-09-04 | Revisione dei volti a mano, e cinque abbinamenti recuperati dalle lettere nordiche. |
| 1.14 | 2026-09-04 | Pubblicata online. Il link gira davvero su WhatsApp. |
| 1.13 | 2026-09-04 | Fetta 7 costruita: scambi fra squadre. |
| 1.12 | 2026-09-04 | Fetta 6 costruita: esportazione delle rose, con anteprima e avvertimenti. |
| 1.11 | 2026-09-04 | Fetta 5 costruita: i volti del facepack arrivano nel listone e nell asta. |
| 1.10 | 2026-09-03 | Correzioni sulle rose con motivo obbligatorio, e registro dell asta visibile a tutti. |
| 1.9 | 2026-09-03 | Rose sempre in vista, obiettivi vivi, navigazione che torna in asta. |
| 1.8 | 2026-09-03 | Prima asta provata davvero, con compagni di lega finti. Catena automatica, riempimento per nome, schermo condiviso con le rose. |
| 1.7 | 2026-09-03 | Slot come il regolamento, con un massimale a testa. Colonna del ruolo nel listone. Tutte le schermate provate tranne l asta in corso. |
| 1.6 | 2026-09-03 | Fasce per reparto e filtro del reparto in corso. L asta pesca solo dal listone della stagione della lega. |
| 1.5 | 2026-09-03 | Fetta 4 completata: sette varianti, modalità live, passo, poteri dell amministratore, rete di sicurezza. |
| 1.4 | 2026-09-02 | Fetta 4a costruita: motore d asta, timer del server, schermo condiviso con i suoni. |
| 1.3 | 2026-09-02 | Fetta 3 costruita: lista obiettivi con i quattro metodi. |
| 1.2 | 2026-09-02 | Fetta 2 costruita: importazione e tabella del listone. |
| 1.1 | 2026-09-02 | Fette 0 e 1 costruite. Vincolo di calendario chiarito. |
| 1.0 | 2026-09-02 | Prima stesura. |
