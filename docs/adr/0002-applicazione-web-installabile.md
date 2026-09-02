# ADR-0002 · Applicazione web installabile, non app da store

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
project-manager

---

## Contesto

Fantasta deve girare contemporaneamente su tre superfici diverse durante la stessa serata: i
telefoni dei partecipanti, il portatile dell'amministratore, e un televisore o monitor grande che
fa da tabellone condiviso.

## Opzioni valutate

### A · Applicazione web installabile

Un'applicazione web moderna che si aggiunge alla schermata iniziale e si comporta come un'app
installata.

**Pro** · Un solo codice per tutte e tre le superfici. Si distribuisce con un link, la stessa strada
già prevista per il codice di invito su WhatsApp. **Le correzioni arrivano a tutti ricaricando la
pagina**: durante una serata d'asta questo è decisivo. Nessun account sviluppatore, nessuna
revisione, nessun costo annuale.

**Contro** · Le notifiche push su iPhone funzionano solo dopo che l'utente ha aggiunto l'app alla
schermata iniziale, e va spiegato. Il suono non può partire prima di un tocco dell'utente, quindi lo
schermo condiviso deve aprirsi su una schermata di attivazione audio. Nessuna presenza negli store.

### B · App nativa con React Native

**Pro** · Audio, vibrazione e notifiche senza limitazioni. Sensazione nativa.

**Contro** · Il televisore richiede comunque una versione web, quindi due superfici da mantenere.
Su iPhone: 99 dollari l'anno e revisione di Apple, oppure TestFlight che scade ogni 90 giorni. Ogni
correzione richiede una nuova pubblicazione: **un difetto scoperto la sera dell'asta non si ripara
in tempo**. Molto più lavoro a parità di funzioni.

## Decisione

**Applicazione web installabile.** Il criterio che decide non è tecnico ma operativo: la capacità di
correggere un difetto durante la serata vale più di qualunque rifinitura nativa, in un'app che si
usa poche volte l'anno ma in condizioni in cui non si può fallire.

## Conseguenze

**Diventa più facile** · Distribuzione, aggiornamenti, uso su televisore, manutenzione di una sola
base di codice.

**Diventa più difficile** · Due vincoli vanno progettati esplicitamente invece che dati per
scontati:

1. **Attivazione audio.** Lo schermo condiviso apre su una schermata «Tocca per attivare l'audio».
   Senza, i suoni non partono e sembra un difetto dell'app.
2. **Installazione su iPhone.** Va prevista una guida in-app che spiega come aggiungere l'app alla
   schermata iniziale, altrimenti nessuno lo fa.

**Rischio accettato** · Le notifiche push saranno meno affidabili che in un'app nativa. Per questa
app contano poco: durante l'asta tutti guardano lo schermo, non le notifiche.

## Reversibilità

**Media.** Backend, regole di dominio e modello dati si riusano interamente. Si rifarebbe solo
l'interfaccia. Un passaggio a nativo resta possibile in futuro senza buttare via il lavoro.
