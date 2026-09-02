# 05 · L'asta in tempo reale

**Scopo** · Descrivere il meccanismo che tiene sincronizzate tutte le superfici durante l'asta:
canale realtime, timer autoritativo, offerte simultanee, riconnessioni.
**Proprietario** · backend-engineer, con il frontend-engineer come consumatore del contratto
**Stato** · ✅ motore, timer, sincronia, varianti, passo e poteri dell amministratore realizzati e verificati
**Data** · 2026-09-02

---

## 1. Cosa fa

Dieci persone allo stesso tavolo guardano tre superfici diverse. Questo documento spiega come fanno
a vedere la stessa cosa nello stesso istante, e cosa succede quando qualcosa va storto: due rilanci
nello stesso millesimo di secondo, un telefono che perde la linea, la pagina ricaricata a due
secondi dalla fine.

## 2. Come funziona

### 2.1 Il canale

Ogni asta ha un canale realtime dedicato. Tutte le superfici della lega vi si iscrivono e ricevono
le stesse notifiche: nuovo lotto aperto, nuova offerta, passo dichiarato, lotto aggiudicato, turno
avanzato, asta in pausa.

Le notifiche contengono **solo dati pubblici**. Le informazioni private, la lista obiettivi e le
note personali, non passano mai dal canale condiviso: stanno sul dispositivo di chi le possiede e si
incrociano lì con quello che arriva dal canale.

### 2.2 Il timer, spiegato bene

È il punto più delicato di tutta l'app, quindi vale la pena scriverlo per esteso.

Il server non manda un tic ogni secondo. Salva **un solo istante** sul lotto:
`last_bid_at`, l'ora esatta dell'ultimo rilancio. Tutto il resto si ricava da lì.

```
attesa     finché  adesso <  last_bid_at + inattività
countdown  quando  adesso >= last_bid_at + inattività
scaduto    quando  adesso >= last_bid_at + inattività + countdown
```

> **Semplificazione rispetto al disegno iniziale.** Il progetto prevedeva anche un secondo istante,
> `countdown_started_at`, valorizzato all'avvio del conto alla rovescia. Realizzandolo si è visto
> che è ricavabile, ed è quindi un dato in più da tenere allineato senza guadagnarci niente: due
> istanti che possono divergere sono peggio di uno solo che non può. Il campo non esiste.

Ogni superficie calcola da sola quanti secondi mancano, sottraendo dall'ora corrente. Il risultato è
lo stesso per tutti perché la base è la stessa, e chi ricarica la pagina riprende esattamente da
dove era.

**Chi chiude il lotto quando il countdown finisce?** Non il telefono che arriva primo a zero: sarebbe
il telefono a decidere, e un orologio sfasato falserebbe l'asta. Il meccanismo previsto è doppio:

1. ✅ La superficie che vede il countdown a zero manda al server una richiesta «chiudi questo lotto».
   Il server **ricalcola dai propri istanti** e chiude solo se è davvero scaduto. Se non lo è,
   rifiuta e non succede niente. Verificato: la richiesta anticipata riceve «Il tempo non è ancora
   finito».
2. ✅ Un compito pianificato sul server passa **ogni dieci secondi** a chiudere i lotti scaduti che
   nessuno ha segnalato, per esempio perché tutti hanno chiuso l'app. Nel caso normale non fa
   niente, perché il lotto è già stato chiuso dalla prima gamba. Verificato: un lotto scaduto e
   non segnalato viene chiuso e aggiudicato al prezzo giusto.

Il secondo meccanismo è la rete di sicurezza; il primo è ciò che rende la chiusura istantanea agli
occhi di chi è al tavolo.

### 2.3 Scarto degli orologi

Se l'orologio di un telefono è indietro di cinque secondi, quel telefono vedrebbe cinque secondi in
più. Alla connessione, ogni superficie confronta la propria ora con quella dichiarata dal server e
si tiene lo scarto, applicandolo a ogni calcolo. È una correzione di poche righe che evita la
domanda «ma perché sul mio ne segna ancora tre?».

### 2.4 Due rilanci nello stesso istante

Succederà, ed è normale. Le offerte si scrivono in modo **serializzato**: il server prende il lotto,
lo blocca, verifica e scrive. La seconda offerta trova il lotto già aggiornato.

| Caso | Esito |
|---|---|
| Due offerte da 31, arrivate a 3 millesimi di distanza | La prima vale. La seconda viene rifiutata con «Offerta già superata, sei a 31: rilancia». |
| Offerta da 30 quando il corrente è già 32 | Rifiutata, stesso messaggio. |
| Offerta oltre il massimo offribile | Rifiutata prima ancora di toccare il lotto. |
| Offerta su un ruolo già completo | Rifiutata. |
| Offerta su un lotto chiuso da 200 ms | Rifiutata con «Il calciatore è stato appena assegnato». |

L'interfaccia **non finge**. Il numero sul bottone non sale finché il server non ha confermato: un
rilancio che sembra riuscito e poi si annulla è peggio di un rilancio lento. Il ritardo si copre con
uno stato di attesa sul bottone, non con un valore inventato.

### 2.5 Il turno, nell'asta a chiamata

Il server tiene l'indice del turno corrente e l'ordine delle squadre. Dopo ogni aggiudicazione o
passaggio avanza al successivo, saltando chi ha già completato il reparto in corso e chi non ha più
crediti sufficienti nemmeno per l'offerta minima.

Se **tutti** sono da saltare, il reparto è finito: nelle varianti per ruolo si passa al reparto
successivo, e lo schermo condiviso lo annuncia con la campanella.

### 2.6 Da quale listone si pesca

Ogni lega dichiara la sua stagione, e l'asta pesca **solo da quella**. Vale sia per l'estrazione
automatica, sia per la chiamata: un calciatore di un'altra stagione viene rifiutato con un messaggio
che nomina tutte e due, così il disallineamento si legge invece di doverlo indovinare.

L'importazione, dal canto suo, ritira i calciatori mancanti della sola stagione che si sta caricando:
il listone nuovo non cancella la storia del vecchio. Vedi
`docs/decisioni/2026-09-03-il-listone-ha-una-stagione.md`.

### 2.7 Riconnessione

Chi torna online non ricostruisce niente a mano: richiede lo stato corrente dell'asta e gli eventi
successivi all'ultimo che aveva ricevuto. Il registro eventi ha un numero progressivo proprio per
questo. In due richieste è di nuovo allineato.

Sulla vista personale compare un indicatore di connessione. Se il canale cade, l'utente lo **vede**:
non gli si lascia credere di essere in asta mentre sta guardando una schermata congelata.

### 2.8 Modalità live

Quando l'asta è condotta a voce, il timer è spento e nessuno rilancia dal telefono. Il canale resta
attivo perché lo schermo condiviso e le viste personali mostrino comunque rose, crediti e listone
aggiornati mentre l'amministratore registra le aggiudicazioni.

## 3. File coinvolti

| File | Cosa contiene |
|---|---|
| `app/supabase/migrations/20260902220000_asta.sql` | Tabelle, policy, motore: chiamata, rilancio, chiusura, avanzamento del turno |
| `app/src/features/asta/api.ts` | Interrogazioni, canale realtime, scarto degli orologi, azioni |
| `app/src/features/asta/useTimer.ts` | Lo stato del countdown ricavato dagli istanti del server |
| `app/src/features/asta/suoni.ts` | I suoni, sintetizzati senza file audio |
| `app/src/pages/PaginaAsta.tsx` | La vista personale |
| `app/src/pages/PaginaSchermoAsta.tsx` | Lo schermo condiviso |
| `scripts/verifica-asta.mjs` | 26 prove sul motore |

## 4. Decisioni e perché

- **Timestamp invece di tic.** Meno traffico, riconnessione gratuita, nessuna deriva.
- **Chiusura verificata dal server, sollecitata dal client.** Unisce la reattività della prima
  soluzione alla correttezza della seconda.
- **Nessun aggiornamento ottimistico sulle offerte.** In un'asta fra amici, un numero che torna
  indietro genera una discussione. Meglio 200 millisecondi di attesa onesta.
- **Compito pianificato come rete di sicurezza.** Senza, un lotto potrebbe restare aperto per sempre
  se tutti chiudono l'app.

## Da sapere prima di intervenire

Il caso peggiore non è «due offerte insieme», è **«offerta che arriva mentre il countdown scade»**.
Vanno gestiti nello stesso blocco transazionale: o l'offerta entra e il countdown si azzera, o il
lotto si chiude e l'offerta viene rifiutata. Mai entrambe.

## Aperto / TODO

- 🔴 Comportamento se internet cade a tutta la stanza. Va deciso se serve una modalità di ripiego in
  cui l'amministratore registra tutto a mano e si risincronizza dopo.
- ✅ Compito pianificato di sicurezza: ogni dieci secondi, versionato nella migrazione 0010.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.3 | 2026-09-03 | L asta pesca solo dal listone della stagione della lega. |
| 1.2 | 2026-09-03 | Varianti, passo, poteri dell amministratore e rete di sicurezza pianificata. |
| 1.1 | 2026-09-02 | Motore realizzato. Semplificazione: il countdown si ricava dal solo `last_bid_at`, senza un secondo istante da tenere allineato. |
| 1.0 | 2026-09-02 | Prima stesura. |
