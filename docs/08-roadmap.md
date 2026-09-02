# 08 · Roadmap

**Scopo** · Stabilire in che ordine si costruisce, con l'unica regola che conta: ogni fetta deve
finire in qualcosa che si può **mostrare e usare**, non in uno strato invisibile.
**Proprietario** · project-manager
**Stato** · 🟡 Fette da 0 a 4 costruite e verificate lato server, mai viste in un browser
**Data** · 2026-09-02

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

### Fetta 0 · Fondamenta — 🟡 in corso

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
| Schermate viste in un browser | 🔴 mai aperte |
| Accesso con Google | 🔴 provider non ancora configurato |
| Pubblicazione online | 🔴 |

### Fetta 1 · Leghe, inviti e squadre — 🟡 costruita, mai vista in un browser

Creazione lega con tutte le regole, caricamento del PDF del regolamento, codice di invito
condivisibile su WhatsApp, ingresso in lega, creazione della propria squadra con nome.

**Si dimostra così**: da un telefono creo la lega, mando il codice su WhatsApp a un secondo
dispositivo, che entra e crea la sua squadra. Entrambi vediamo l'elenco dei partecipanti aggiornato.

| Pezzo | Stato |
|---|---|
| Tabelle, policy, funzioni di creazione e ingresso | ✅ 30 prove su 30, `node scripts/verifica-leghe.mjs` |
| Codice di invito, rigenerazione, limite ai tentativi | ✅ verificato |
| Regolamento in PDF, archivio privato con indirizzi firmati | ✅ verificato |
| Schermate: elenco leghe, creazione, ingresso, riepilogo | 🟡 scritte e compilate, **mai aperte in un browser** |
| Prova vera su due dispositivi | 🔴 |

### Fetta 2 · Listone e statistiche — 🟡 costruita, mai vista in un browser

Importazione del listone, importazione delle statistiche, tabella con filtri per ruolo e squadra e
ordinamento su ogni colonna.

**Si dimostra così**: su un telefono, filtro i centrocampisti del Napoli ordinati per media voto, e
lo scorrimento è fluido con tutte le righe caricate.

| Pezzo | Stato |
|---|---|
| Lettore di file .xlsx e .csv, senza dipendenze | ✅ 17 prove, `node --experimental-strip-types scripts/verifica-listone.mjs` |
| Riconoscimento delle colonne, righe scartate con il motivo | ✅ verificato |
| Importazione ripetibile, chi sparisce viene ritirato e non cancellato | ✅ verificato |
| Tabella con filtri per ruolo e squadra e ordinamento su ogni colonna | 🟡 scritta, **mai aperta in un browser** |
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
| Schermata con fasce, tetti, note, slot e incroci | 🟡 scritta, **mai aperta in un browser** |
| Contatore degli obiettivi ancora liberi durante l'asta | 🔴 arriva con la Fetta 4f |
| Rifatta dopo la prova d uso: un metodo solo, aggiunte dal posto giusto, riordino trascinando | ✅ 34 prove |
| Fasce e slot **divisi per reparto**, con il filtro che nasconde gli altri tre | ✅ 36 prove, `node scripts/verifica-obiettivi.mjs` |

### Fetta 4 · L'asta — ✅ costruita, 🔴 mai vista in un browser

È il cuore dell'app e il pezzo più difficile. Va spezzata.
| Sotto-fetta | Stato |
|---|---|
| **4a · Motore** | ✅ 26 prove, `node scripts/verifica-asta.mjs` |
| **4b · Schermo condiviso** | 🟡 scritto con i suoni, **mai aperto in un browser** |
| **4c · Varianti** | ✅ tutte e sette, più la modalità live |
| **4d · Poteri amministratore** | ✅ passa, assegna, aggiudica, annulla, pausa |
| **4e · Chiamata con passo** | ✅ irreversibile, chiude in anticipo quando resta uno solo |
| **4f · Aggancio obiettivi** | ✅ tetto e nota del calciatore in asta, nella vista personale; la scorciatoia apre gli obiettivi sul reparto in corso |
| Rete di sicurezza sui lotti dimenticati | ✅ pianificata ogni dieci secondi |
| Prova su dispositivi veri | 🔴 |

| Sotto-fetta | Contenuto | Come si dimostra |
|---|---|---|
| **4a · Motore** | Impostazioni pre-asta, apertura, chiamata, offerte, timer del server, aggiudicazione. Solo metodo a chiamata libera totale, solo vista personale. | Due telefoni si rilanciano davvero; il countdown scade e il calciatore viene assegnato; i crediti scalano. |
| **4b · Schermo condiviso** | La pagina da proiettare, con i suoni e il massimo spendibile di ognuno. | Il televisore mostra la chiamata e fa il rumore giusto quando qualcuno rilancia. |
| **4c · Varianti** | Chiamata per ruoli e ibrida, asta alfabetica, asta random, con e senza divisione per ruolo. | Si apre un'asta per ognuna delle sette combinazioni e si verifica il comportamento. |
| **4d · Poteri amministratore** | Passa, assegnazione rapida, annulla ultima aggiudicazione, pausa. | L'amministratore passa un calciatore e ne assegna un altro senza asta. |
| **4e · Chiamata con passo** | Esclusione dai rilanci, chiusura anticipata. | Tutti passano tranne uno e il lotto si chiude subito. |
| **4f · Integrazione obiettivi** | Durante l'asta la lista mostra solo gli obiettivi liberi, col contatore; il calciatore in asta mostra le mie note e il mio tetto. | Chiamo un mio obiettivo e vedo il tetto che mi ero dato. |

### Fetta 5 · Facepack

Caricamento in blocco, associazione automatica, schermata di abbinamento manuale per il resto, foto
nel listone e nelle rose.

### Fetta 6 · Fine asta ed esportazione

Rilevamento rose complete, riepilogo finale, esportazione CSV della propria rosa o di tutte.

### Fetta 7 · Scambi

Proposta, accettazione, conguaglio in crediti se le regole lo permettono. Solo se la lega li attiva.

### Fetta 8 · Revisione iper-critica

Applicazione di `Metodo-QA-Testing-Iper-Critico.md` sull'app funzionante, un percorso per volta,
partendo dall'asta.

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

- 🔴 Nessuna schermata è mai stata aperta in un browser: è la verifica che manca, e ormai riguarda quindici pagine.
- 🔴 Serve il file ufficiale del listone per provare l importazione sul formato vero.
- 🔴 Pubblicazione online, necessaria perché il link giri davvero su WhatsApp.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.6 | 2026-09-03 | Fasce per reparto e filtro del reparto in corso. L asta pesca solo dal listone della stagione della lega. |
| 1.5 | 2026-09-03 | Fetta 4 completata: sette varianti, modalità live, passo, poteri dell amministratore, rete di sicurezza. |
| 1.4 | 2026-09-02 | Fetta 4a costruita: motore d asta, timer del server, schermo condiviso con i suoni. |
| 1.3 | 2026-09-02 | Fetta 3 costruita: lista obiettivi con i quattro metodi. |
| 1.2 | 2026-09-02 | Fetta 2 costruita: importazione e tabella del listone. |
| 1.1 | 2026-09-02 | Fette 0 e 1 costruite. Vincolo di calendario chiarito. |
| 1.0 | 2026-09-02 | Prima stesura. |
