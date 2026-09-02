# Registro · Fasce e slot diventano una scelta, non due interruttori

**Data** · 2026-09-03 · **Chi** · l'utente, provando la schermata · **Realizza** · frontend e backend
**Dove** · migrazione 0012 e schermata della lista obiettivi

---

## Cosa non funzionava

La prima versione della lista obiettivi metteva i quattro metodi su quattro interruttori
indipendenti: fasce, tetto di spesa, slot, incrocio portieri. Tecnicamente corretto rispetto alla
richiesta iniziale, «completamente personalizzabile secondo il metodo che ognuno preferisce».

All'uso è risultata confusa. Le parole dell'utente: «ci sono le funzioni ma in ordine sparso e
confusionario».

Il difetto non era in nessuna delle funzioni, era nel fatto che la schermata non prendeva posizione.
Apriva su un elenco di possibilità tutte accese insieme, e lasciava a chi la usava il compito di
capire da solo quale fosse il suo modo di lavorare.

## Cosa abbiamo capito

**Fasce e slot rispondono alla stessa domanda in due modi alternativi**: in che ordine provo a
comprare. Tenerli accesi insieme non aggiunge libertà, aggiunge lavoro: due strutture da riempire e
da tenere allineate, per una decisione sola.

**Tetto di spesa e nota sono un'altra cosa.** Non rispondono a «in che ordine», ma a «fino a
quanto» e «cosa devo ricordarmi». Si affiancano a tutti e due i metodi.

**L'incrocio portieri è un'altra cosa ancora**: riguarda solo un reparto e convive con qualsiasi
metodo.

## Cosa abbiamo scelto

1. **Un metodo solo**, fasce oppure slot, scelto all'inizio in una schermata che spiega la
   differenza invece di elencare interruttori.
2. **Il tetto di spesa è un'aggiunta**, accendibile in tutti e due.
3. **La nota c'è sempre**: è quella che serve davvero, perché ricompare sul telefono nel momento in
   cui quel nome viene chiamato all'asta.
4. **Si aggiunge dal posto in cui il calciatore deve finire.** Si tocca la fascia e si aggiungono i
   nomi lì dentro; si tocca lo slot e si scelgono i suoi candidati. Prima c'era un unico pulsante
   «aggiungi» in fondo alla pagina e poi bisognava smistare a mano.
5. **L'ordine si cambia trascinando**, dentro il ruolo per le fasce e dentro lo slot per i
   candidati, con due frecce sempre presenti per chi usa la tastiera o ha spento le animazioni.

## Cosa abbiamo scartato

**Lasciare la combinazione possibile «per chi la vuole».** Sarebbe stato più facile e sarebbe
sembrato più generoso. Ma un'applicazione che non sceglie scarica la scelta sull'utente proprio nel
momento in cui è meno preparato a farla, cioè la prima volta che apre la schermata. Qui la scelta è
il primo passo, ed è spiegata.

**Cancellare la struttura dell'altro metodo quando si cambia.** Sarebbe stato più pulito da
programmare. Ma chi prova un metodo e torna indietro non deve pagare la prova: fasce e slot
restano dove sono, e si ritrovano.

## Cosa ci portiamo dietro

- **«Configurabile» non è un sinonimo di «chiaro».** Quattro interruttori indipendenti sono più
  configurabili di una scelta fra due, e sono peggio.
- **Quando due funzioni rispondono alla stessa domanda, vanno messe in alternativa.** Se coesistono,
  la prima cosa che l'utente deve fare è capire perché ci sono entrambe.
- **Questo l'ha trovato l'uso, non le prove.** Le ventiquattro prove sulla lista obiettivi erano
  verdi: controllavano che ogni funzione funzionasse, non che l'insieme avesse senso. È una cosa
  che nessuna prova automatica dirà mai.
