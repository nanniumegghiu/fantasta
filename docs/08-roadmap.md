# 08 · Roadmap

**Scopo** · Stabilire in che ordine si costruisce, con l'unica regola che conta: ogni fetta deve
finire in qualcosa che si può **mostrare e usare**, non in uno strato invisibile.
**Proprietario** · project-manager
**Stato** · 🔴 nessuna fetta completata
**Data** · 2026-09-02

---

## 1. Cosa fa

Divide il lavoro in fette verticali. Una fetta orizzontale sarebbe «facciamo tutto il database»:
alla fine non si vede niente e non si sa se funziona. Una fetta verticale attraversa tutti gli
strati e produce una cosa che si accende.

## 2. Le fette

### ⚠️ Vincolo di calendario da chiarire subito

Oggi è il 2 settembre 2026. Le aste del fantacalcio si fanno tipicamente **fra fine agosto e metà
settembre**. Se l'asta di questa lega è fra due settimane, l'ordine qui sotto va accorciato in modo
brutale e alcune cose vanno sacrificate. È la prima domanda in `docs/09-decisioni-aperte.md`.

---

### Fetta 0 · Fondamenta — 🟡 in corso

Progetto creato, backend attivo, accesso funzionante, pubblicazione online.

**Si dimostra così**: mi registro con Google da telefono, entro, vedo una pagina «Le mie leghe»
vuota col mio nome, esco e rientro.

| Pezzo | Stato |
|---|---|
| Progetto web che compila, con icone e installabilità | ✅ verificato: compilazione e server di anteprima |
| Schermate di accesso, registrazione, «Le mie leghe» | 🟡 scritte, mai aperte in un browser |
| Migrazione dei profili con le sue policy | 🟡 scritta, mai applicata |
| Progetto Supabase e chiavi | 🔴 servono all'utente |
| Accesso con Google e con email, provato davvero | 🔴 |
| Pubblicazione online | 🔴 |

### Fetta 1 · Leghe, inviti e squadre

Creazione lega con tutte le regole, caricamento del PDF del regolamento, codice di invito
condivisibile su WhatsApp, ingresso in lega, creazione della propria squadra con nome.

**Si dimostra così**: da un telefono creo la lega, mando il codice su WhatsApp a un secondo
dispositivo, che entra e crea la sua squadra. Entrambi vediamo l'elenco dei partecipanti aggiornato.

### Fetta 2 · Listone e statistiche

Importazione del listone, importazione delle statistiche, tabella con filtri per ruolo e squadra e
ordinamento su ogni colonna.

**Si dimostra così**: su un telefono, filtro i centrocampisti del Napoli ordinati per media voto, e
lo scorrimento è fluido con tutte le righe caricate.

### Fetta 3 · Lista obiettivi

I quattro metodi richiesti, tutti facoltativi e combinabili: fasce, tetto di spesa, slot della rosa
ideale, incrocio portieri. Note libere per calciatore.

**Si dimostra così**: costruisco una lista con tre fasce, metto i tetti, definisco sei slot in
attacco con i candidati, creo un incrocio fra due portieri. Da un altro account, la stessa lista è
**invisibile**.

### Fetta 4 · L'asta

È il cuore dell'app e il pezzo più difficile. Va spezzata.

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

- 🔴 Data dell'asta reale: determina se questa roadmap regge o va tagliata.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.0 | 2026-09-02 | Prima stesura. |
