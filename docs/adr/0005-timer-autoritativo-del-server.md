# ADR-0005 · Il countdown è calcolato da istanti salvati dal server

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · project-manager e backend-engineer,
decisione tecnica interna

---

## Contesto

Durante l'asta, dopo un tot di secondi dall'ultimo rilancio parte un countdown; se scade senza altre
offerte, il calciatore è assegnato automaticamente. Il conto alla rovescia è visibile su tutti i
telefoni e sul tabellone contemporaneamente, in una stanza dove tutti si guardano in faccia.

Se due dispositivi mostrano numeri diversi, o se uno assegna il calciatore mezzo secondo prima
dell'altro, nasce una discussione che l'app dovrebbe proprio evitare.

## Opzioni valutate

### A · Ogni dispositivo conta per conto suo

Un contatore locale che parte quando arriva la notifica di un rilancio.

**Pro** · Semplicissimo, nessun traffico.

**Contro** · Gli orologi dei telefoni non sono allineati e le notifiche non arrivano nello stesso
istante. Chi ricarica la pagina perde il conto. Chi decide l'assegnazione? Il primo che arriva a
zero, cioè il telefono con l'orologio più avanti. Inaccettabile.

### B · Il server manda un tic ogni secondo

**Pro** · Tutti vedono lo stesso numero.

**Contro** · Traffico continuo per tutta la durata dell'asta, moltiplicato per ogni dispositivo.
Chi si disconnette per due secondi vede il numero saltare. Consuma quota realtime senza motivo.

### C · Il server salva gli istanti, i dispositivi calcolano la differenza

Sul lotto sono registrati `last_bid_at` e `countdown_started_at`. Ogni dispositivo calcola i secondi
mancanti sottraendo dall'ora corrente, corretta per lo scarto rispetto all'orologio del server.

**Pro** · Nessun traffico continuo. Chi ricarica riprende esattamente da dove era. Tutti calcolano
sulla stessa base e vedono lo stesso numero.

**Contro** · Serve una correzione dello scarto degli orologi, poche righe. Serve un meccanismo
esplicito che decida **chi chiude** il lotto quando il tempo finisce.

## Decisione

**Opzione C**, con chiusura a doppio meccanismo:

1. Il dispositivo che vede il countdown a zero **chiede** al server di chiudere il lotto. Il server
   ricalcola dai propri istanti e chiude solo se è davvero scaduto, altrimenti rifiuta senza
   conseguenze. Questo rende la chiusura istantanea per chi è al tavolo.
2. Un compito pianificato sul server passa periodicamente a chiudere i lotti scaduti che nessuno ha
   segnalato, per esempio perché tutti hanno chiuso l'app. È la rete di sicurezza.

## Conseguenze

**Diventa più facile** · Riconnettersi senza perdere il filo. Contenere il traffico realtime dentro
i limiti del piano gratuito. Ricostruire l'andamento di un lotto dal registro eventi.

**Diventa più difficile** · Va gestito con attenzione il caso limite in cui **un'offerta arriva
mentre il countdown scade**: o l'offerta entra e il countdown si azzera, o il lotto si chiude e
l'offerta viene rifiutata, e le due cose devono avvenire nella stessa transazione. È il punto più
delicato del motore d'asta ed è elencato fra i casi limite obbligatori in
`.claude/skills/regole-asta/SKILL.md`.

## Reversibilità

**Alta.** È una scelta interna al motore d'asta, non tocca né lo schema né l'interfaccia.
