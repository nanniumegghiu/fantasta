# Rapporto QA · L'asta in corso, guardata con occhio ostile

**Ciclo** · 1 · **Data** · 2026-09-04 · **Conduce** · qa-lead
**Percorso in esame** · l'asta viva: schermo condiviso e dispositivo personale
**Motivo del ciclo** · l'utente ha detto che l'app «sembra scarna, non dà la sensazione di app
vivace e moderna con belle animazioni durante l'asta». Questo ciclo va a vedere se ha ragione, e
se sì, **perché**.

> **Regola di onestà.** I tester sono simulazioni. Ogni numero è marcato `[stimato]` con il modo in
> cui è stato ricavato, oppure `[non verificabile]`. I difetti letti nel codice portano file e
> riga; i sospetti stanno in fondo, separati, e non sono spacciati per certezze.

---

## FASE 1 · La squadra e la copertura

### I ruoli dell'app

| Ruolo | Chi è |
|---|---|
| **Amministratore di lega** | Conduce l'asta dal telefono e tiene lo schermo sul televisore |
| **Partecipante** | Rilancia dal proprio telefono, tiene d'occhio rosa, crediti e obiettivi |
| **Il televisore** | Non è una persona: è uno schermo a tre metri di distanza, senza nessuno che lo tocchi |

### I profili

| Profilo | Chi è | Come si comporta |
|---|---|---|
| **Dario, 34, sistemista** — l'Esperto | Fa il fantacalcio da dodici anni | Apre due schede, prova a rilanciare oltre il suo massimo, cerca la scorciatoia da tastiera |
| **Sara, 29, commessa** — l'Utente Medio | Prima asta con un'app | Segue il percorso ovvio. Se deve tornare indietro due volte, si spazientisce |
| **Nonno Pino, 67** — il Neofita | Ha imparato WhatsApp l'anno scorso | Si blocca al primo testo poco chiaro. **Se non capisce, smette e chiede a voce** |

### Tabella di copertura, e cosa è stato escluso

| # | Funzione | Profilo | Dispositivo | Perché proprio questa casella |
|---|---|---|---|---|
| 1 | Schermo condiviso durante un rilancio | — (nessuno lo tocca) | TV 1080p a 3 m | È l'unica schermata che si guarda da lontano: le regole del mobile non valgono |
| 2 | Aggiudicazione di un calciatore | Sara | TV + iPhone insieme | È il momento emotivo dell'asta, e succede su due schermi contemporaneamente |
| 3 | Rilancio dal telefono | Dario | Android mobile | Chi rilancia in fretta è chi trova per primo i limiti |
| 4 | Perdere la testa dell'asta | Nonno Pino | iPhone mobile | Il caso in cui l'informazione deve arrivare senza che tu la stia cercando |
| 5 | Movimento ridotto attivo | Sara | iOS con «Riduci movimento» | Chi soffre di emicrania vestibolare non è un caso di nicchia in una stanza da otto persone |

**Escluse, e perché.** Tablet Android e desktop per il *dispositivo personale*: il layout è lo
stesso di mobile con più margine, e non ha niente da dire che mobile non abbia già detto. Il
percorso di preparazione (leghe, listone, obiettivi) è escluso da **questo** ciclo: l'utente ha
già aperto e provato quelle schermate, e questo ciclo è mirato all'asta viva, che nessuno ha mai
visto. Entreranno nel ciclo 2.

---

## FASE 2 · La mappa e la strada

### Cosa fa l'app durante un'asta

1. Estrae o fa chiamare un calciatore · 2. Mostra chi è, con volto, stemma e statistiche ·
3. Raccoglie i rilanci · 4. Conta il tempo di inattività · 5. Fa partire il countdown ·
6. Aggiudica · 7. Aggiorna crediti e rose · 8. Apre il calciatore dopo ·
9. Suona, sullo schermo condiviso · 10. Mostra a ciascuno i propri obiettivi e il proprio tetto

### La raccomandazione, non un menu

Si guarda **il momento dell'aggiudicazione** per primo, e subito dopo **il momento in cui perdi la
testa dell'asta**. Sono i due istanti in cui l'app deve dire qualcosa a otto persone insieme, e
sono anche i due in cui oggi non dice quasi niente. Tutto il resto — colori, spaziature, tabelle —
è già a posto e non merita il tempo.

---

## FASE 3 · I rapporti

```
--- RAPPORTO DI TESTING QA: Schermo condiviso · aggiudicazione ---
- Ruolo Analizzato: il televisore (nessuno lo tocca)
- Profilo Tester: Sara (Utente Medio), che guarda da tre metri
- Dispositivo: TV 1080p via browser, più iPhone in mano

[METRICHE QUANTITATIVE]
- Time on Task: non si applica: qui non c'è un compito, c'è un evento
- Click/Tap Rate: 0 — lo schermo condiviso non si tocca mai. Corretto.
- Tempi di Caricamento Simulati: [non verificabile in simulazione] — servirebbe
  la TV vera con la sua rete. Il codice interroga ogni 1500 ms
  (PaginaSchermoTv.tsx), quindi il ritardo peggiore atteso è ~1,5 s [stimato]
- Tasso di Errore: non si applica
- Indice di Frustrazione: 6/10 [stimato] — non per difficoltà, per
  **anticlimax**: il momento più atteso della serata passa senza che lo schermo
  se ne accorga

[ANALISI QUALITATIVA E VISIVA]
✔️ COSA FUNZIONA
   La composizione è forte e leggibile da lontano: volto 112 px, nome a 6xl,
   offerta a 9rem in oro. La scheda entra dal basso con una rotazione
   (PaginaSchermoAsta.tsx:392-396) ed è esattamente quello che il documento di
   design prometteva. Il numero dell'offerta rimbalza a ogni rilancio (:431-435).
   Il countdown vira al rosso sotto i 3 secondi (:465). Questo pezzo è buono:
   una riga e si passa oltre.

❌ BUG E ATTRITI
   1. **L'aggiudicazione ha il suono e non ha l'immagine.**
      `features/asta/suoni.ts:149` definisce `suonoAggiudicazione`, e viene
      suonato. Sullo schermo, però, non succede niente: la scheda del calciatore
      appena venduto **sparisce** e al suo posto ne compare un'altra. Nessuna
      celebrazione, nessun nome di squadra che cresce, nessun coriandolo.
      `docs/04-frontend-e-design.md:76` prometteva testualmente «Coriandoli
      brevi e il nome della squadra che ingrandisce · 900 ms». Nel codice
      **non esiste**: `grep -ri "coriandol\|confetti" app/src` → nessun
      risultato. È l'errore che la regola 6 del manuale chiama il più grave del
      progetto: un documento che descrive come esistente ciò che non esiste.
   2. **Niente esce mai di scena.** `AnimatePresence` non compare in nessun file
      dell'applicazione (`grep -r AnimatePresence app/src` → nessun risultato).
      Conseguenza meccanica: ogni cambiamento è uno scatto — la cosa vecchia
      scompare nello stesso fotogramma in cui appare la nuova. Le entrate sono
      curate, le uscite non esistono. **È questa, tecnicamente, la ragione per
      cui l'app "sembra scarna"**: non mancano le animazioni, manca metà di
      ognuna.
   3. **La rosa che si riempie non se ne accorge.** Quando un calciatore entra
      in una rosa, la riga compare nella lista senza alcun movimento
      (PaginaSchermoAsta.tsx:740, un `<li>` semplice). Sullo schermo condiviso
      la rosa che cresce è il racconto della serata, e cresce di nascosto.

⚠️ COSA MANCA
   Il passaggio di reparto. C'è la campanella (`suoni.ts:157`) e non c'è niente
   da vedere: chi ha il volume basso non sa che si è passati ai difensori.

💎 PROPOSTE PREMIUM
   · Aggiudicazione: la scheda si solleva, il nome della squadra entra grande al
     centro, coriandoli nei colori del logo per 900 ms, poi la scheda esce e
     arriva la prossima. È già scritta nel documento di design: va costruita.
   · Il calciatore appena venduto **vola** nella rosa che l'ha preso, e quella
     riga si accende per un istante. Trecento millisecondi che raccontano una
     compravendita meglio di qualunque tabella.
   · Countdown come anello che si svuota intorno al numero, non solo il numero:
     a tre metri una forma si legge prima di una cifra.
------------------------------------------------------------
```

```
--- RAPPORTO DI TESTING QA: Dispositivo personale · perdere la testa dell'asta ---
- Ruolo Analizzato: Partecipante
- Profilo Tester: Nonno Pino (Neofita) e Dario (Esperto)
- Dispositivo: iPhone mobile / Android mobile

[METRICHE QUANTITATIVE]
- Time on Task: rilanciare = 1 tap [stimato] — contato su PaginaAsta.tsx:365-378,
  i tre bottoni +1 / +5 / +10 offrono direttamente. Ottimo.
- Click/Tap Rate: 1 per un'azione core. Sotto la soglia di allarme (>3).
- Tempi di Caricamento Simulati: [non verificabile] — dipende dal canale
  realtime, che in simulazione non si misura
- Tasso di Errore: [non verificabile] — richiede persone vere
- Indice di Frustrazione: 7/10 [stimato] per Nonno Pino, 3/10 per Dario. La
  differenza è tutta nel punto qui sotto.

[ANALISI QUALITATIVA E VISIVA]
✔️ COSA FUNZIONA
   Un tap per rilanciare, con tre importi pronti. Il proprio tetto e le proprie
   note compaiono da sole quando il calciatore è un obiettivo
   (PaginaAsta.tsx:338-356): è la funzione migliore dell'intera schermata, e in
   asta vale più di qualunque animazione.

❌ BUG E ATTRITI
   1. **Perdere la testa dell'asta non si vede e non si sente.** Quando sei il
      miglior offerente, `PaginaAsta.tsx:331` scrive «te» in verde. Quando
      qualcuno ti supera, quella parola diventa il suo nome e cambia colore.
      Nient'altro: nessun movimento, nessuna vibrazione, e i telefoni sono muti
      per scelta (`docs/04` §2.5, ed è una scelta giusta: dieci telefoni che
      suonano insieme sono rumore). Il risultato è che **l'unico evento che
      devi assolutamente notare è quello che l'app ti comunica più
      debolmente**. Chi in quel momento sta guardando la propria rosa, o il
      listone, non se ne accorge affatto.
   2. **Il movimento ridotto è rispettato a metà, e la metà che manca è quella
      che dà fastidio.** `styles/index.css:82-91` azzera durate di animazione e
      transizione **CSS**. Le animazioni di `motion/react` non sono CSS: sono
      pilotate da JavaScript e quella regola non le tocca. Quindi con «Riduci
      movimento» attivo il countdown continua a pulsare all'infinito
      (PaginaSchermoAsta.tsx:453-455, `repeat: Infinity`), che è esattamente il
      caso che `docs/04` §2.4 dichiara di voler evitare, e con la motivazione
      giusta: «possono dare fastidio fisico a chi soffre di emicrania
      vestibolare». `useReducedMotion` non è usato da nessuna parte.
   3. **Il cambio di schermata promesso non esiste.** `docs/04:77` prometteva
      «dissolvenza con scorrimento di 8 px · 180 ms». Le rotte in `App.tsx`
      cambiano di scatto. Da soli 8 px non fanno un'app moderna; ma è la
      seconda riga della stessa tabella che risulta scritta e non costruita.

⚠️ COSA MANCA
   Un modo di sapere che qualcosa è successo **mentre guardi un'altra
   schermata** dell'app. Durante l'asta si va sugli obiettivi e nel listone —
   l'utente l'ha chiesto apposta — e da lì l'asta è invisibile.

💎 PROPOSTE PREMIUM
   · Quando ti superano: la scheda dell'offerta trema una volta sola (120 ms),
     il bordo lampeggia in arancio, e il telefono vibra una volta
     (`navigator.vibrate(30)`, che non fa rumore in una stanza). Chi è al
     telefono lo sente in tasca.
   · Un nastro fisso in cima, mentre sei sul listone o sugli obiettivi, con chi
     è in asta e a quanto: tocchi e torni dentro.
   · I bottoni +1/+5/+10 che si spengono con un movimento quando superi il tuo
     massimo, invece di diventare grigi di colpo.
------------------------------------------------------------
```

---

## FASE 4 · Appendice del team tecnico

**PM.** Il difetto 1 dello schermo condiviso e il difetto 1 del dispositivo personale sono lo
stesso difetto visto da due parti: **l'app non ha una grammatica degli eventi**. Ha una grammatica
degli stati — questo è aperto, questo è chiuso — e la sera dell'asta quello che conta sono i
passaggi. Entra in questo giro. Le proposte di ridisegno (nastro fisso, anello del countdown)
aspettano il ciclo 2: prima si finisce quello che il documento di design aveva già promesso, poi
si promette dell'altro.

**Agente Sicurezza.** Nessun rilievo. Le proposte sono tutte lato client e non toccano permessi,
dati o funzioni del server. `navigator.vibrate` non richiede permessi e non è disponibile su iOS
Safari: va trattato come un di più, mai come l'unico modo di sapere una cosa.

**Agente Backend.** Nessun impatto. Non serve nessuna migrazione, nessuna query nuova: tutti gli
eventi sono già nei dati che il client riceve. Un'unica raccomandazione: la celebrazione
dell'aggiudicazione deve nascere dal **passaggio di stato del lotto** che il client già osserva,
non da una nuova chiamata al server, o sullo schermo del televisore arriverebbe in ritardo di un
giro di interrogazione.

**Agente Frontend.** I coriandoli **non si fanno con una libreria**: ADR-0006 tiene chiuso
l'elenco delle dipendenze, e un pacchetto di coriandoli per 900 ms una volta ogni due minuti non
lo giustifica. Si fanno con una trentina di `motion.div` generati e distrutti, che è meno codice
del pacchetto che lo eviterebbe. Il rispetto del movimento ridotto va risolto **una volta sola e
alla radice**, con `useReducedMotion` letto in un punto e passato a chi anima: risolverlo animazione
per animazione vuol dire dimenticarsene alla prossima. Bocciata invece la proposta del «volo» del
calciatore verso la rosa **sul dispositivo personale**: su 360 px di larghezza sarebbe un elemento
che attraversa lo schermo mentre stai cercando di rilanciare su un altro calciatore. Sullo schermo
condiviso invece ha senso: lì nessuno deve fare niente.

---

## FASE 5 · Riassunto per chi decide

### Red flag, in ordine di gravità

1. **Il momento dell'aggiudicazione è muto sullo schermo.** Otto persone guardano il televisore,
   il martelletto suona, e l'immagine cambia come cambia una diapositiva. È il picco della serata
   e l'app lo tratta come un aggiornamento di tabella.
2. **Chi viene superato non lo sa.** L'unica informazione che obbliga ad agire è quella comunicata
   più piano: una parola che cambia colore, su un telefono muto per scelta.
3. **Chi ha attivato «Riduci movimento» riceve comunque le animazioni pulsanti**, incluso un
   countdown che pulsa senza fine. Il documento aveva previsto il problema e la difesa scritta non
   copre il caso vero.
4. **Due righe della tabella delle animazioni sono scritte e non costruite** (aggiudicazione,
   cambio di schermata). Finché restano lì, il documento mente.

### Proposte, con pro e contro veri

| # | Proposta | Pro | Contro | Sforzo | Costo di inversione |
|---|---|---|---|---|---|
| A | Celebrazione dell'aggiudicazione sullo schermo condiviso: scheda che si solleva, nome della squadra che cresce, coriandoli 900 ms | Riempie il vuoto del momento più importante. Già promesso dal design | 900 ms in cui lo schermo non è disponibile per il lotto dopo: va incastrato con la catena automatica | Medio | Basso: è un componente a sé |
| B | `AnimatePresence` sulle cose che spariscono: lotto, righe di rosa, avvisi | È **la** ragione tecnica della sensazione di scarno. Poco codice, effetto su tutta l'app | Le uscite vanno tenute corte o l'asta sembra lenta | Basso | Nullo |
| C | Quando ti superano: tremito, bordo arancio, vibrazione breve | Risolve la red flag 2, e la risolve nel modo in cui una persona se ne accorge davvero | La vibrazione su iOS Safari non funziona: non può essere l'unico segnale | Basso | Nullo |
| D | `useReducedMotion` letto in un punto solo e rispettato ovunque | Chiude la red flag 3 alla radice, e la promessa del documento torna vera | Va ricordato per ogni animazione nuova: si mette nel contratto del design system | Basso | Nullo |
| E | Il calciatore venduto vola nella rosa che l'ha preso — **solo schermo condiviso** | Racconta la compravendita senza una parola | Bocciato sul telefono dal frontend, per il motivo scritto sopra | Medio | Basso |
| F | Anello del countdown, nastro fisso dell'asta nelle altre schermate | Leggibilità da lontano, e l'asta smette di sparire quando guardi il listone | Sono ridisegni, non completamenti: cambiano il layout | Alto | Medio |

### Cosa il team approva per questo giro

**A, B, C, D, E.** Sono quattro completamenti di quello che il progetto aveva già deciso e uno
piccolo in più: nessuno cambia il layout, nessuno tocca il server, nessuno aggiunge dipendenze.

**F rimandata al ciclo 2**, perché è un ridisegno: si valuta dopo aver visto un'asta vera in
movimento, non prima.

---

> **Qui il protocollo si ferma.** `Metodo-QA-Testing-Iper-Critico.md` è esplicito: le decisioni si
> prendono insieme **prima** di scrivere codice, e nessuna modifica preventiva «tanto era ovvia».
> Nessuna riga dell'applicazione è stata toccata in questo ciclo.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.0 | 2026-09-04 | Primo ciclo: l'asta viva, grafica e animazioni. Quattro red flag, sei proposte, cinque approvate dal team tecnico. |
