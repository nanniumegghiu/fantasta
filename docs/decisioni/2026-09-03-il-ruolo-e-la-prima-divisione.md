# Registro · Il ruolo non è un filtro, è la prima divisione

**Data** · 2026-09-03 · **Chi** · l'utente, guardando avanti al giorno dell'asta · **Realizza** · backend e frontend
**Dove** · migrazione 0014, schermata della lista obiettivi, vista personale dell'asta

---

## Cosa non funzionava

Gli slot avevano un ruolo fin dall'inizio: «Attaccante 1» è un posto d'attacco, non c'era altro modo
di intenderlo. Le fasce no. Una fascia era un contenitore misto, «Da prendere assolutamente», dentro
cui finivano portieri, difensori e attaccanti insieme; il reparto veniva tirato fuori solo alla fine,
raggruppando i nomi al momento di disegnarli.

Funzionava. Ma stava in piedi su un'idea sbagliata: che il ruolo fosse un modo di **guardare** i
dati, e non un modo di **organizzarli**.

Le parole dell'utente: «durante l'asta possa filtrare solo il ruolo in corso di chiamata e nascondere
gli altri ruoli che sarebbero solo rumore… non vedrai attaccanti se stai selezionando gli obiettivi
di difesa».

## Cosa abbiamo capito

Un'asta di fantacalcio si gioca **un reparto alla volta**. Quando si chiamano i portieri, i
difensori non sono meno importanti: sono semplicemente fuori discussione fino a dopo. Tutto quello
che riguarda gli altri tre reparti, in quel momento, è rumore che sta fra l'occhio e la decisione da
prendere in dieci secondi.

Questo vale in due momenti distinti, e sono momenti diversi fra loro:

**Quando prepari.** Stai scegliendo i tuoi difensori. Un elenco che ti propone anche gli attaccanti
non ti offre una possibilità in più, ti fa scorrere più roba per trovare quello che cerchi.

**Quando sei all'asta.** Stai guardando il telefono mentre qualcuno rilancia. La lista deve mostrare
il reparto in corso e basta.

Se il reparto è solo un filtro di visualizzazione, il secondo momento si risolve e il primo no: puoi
nascondere gli attaccanti dopo averli messi dentro, non puoi evitare di vederli mentre scegli.

## Cosa abbiamo scelto

1. **La fascia appartiene a un reparto**, esattamente come lo slot. Il ruolo è una colonna
   obbligatoria di `tiers`, non una proprietà dedotta da chi c'è dentro.
2. **Il vincolo sta nel server.** `aggiungi_a_fascia` scarta i calciatori di un altro reparto, e
   `riordina_obiettivi` rifiuta di spostare un attaccante in una fascia di difensori lasciandolo dov'è.
   Non è un aiuto alla scelta che l'interfaccia offre: è una regola del modello, e vale anche per chi
   chiama la funzione da fuori.
3. **Le fasce di partenza nascono già divise**: tre per reparto, dodici in tutto. Il nome può
   ripetersi fra reparti diversi, perché «Da prendere assolutamente» ha senso per i portieri e per
   gli attaccanti insieme.
4. **Il reparto scelto vive nell'indirizzo**, `?ruolo=D`, non nello stato del componente. Così la
   vista personale dell'asta può portare alla lista già filtrata sul reparto che si sta chiamando, e
   il collegamento resta valido se lo si rimette fra i preferiti.
5. **La scorciatoia dell'asta lo dice nel nome**: durante i difensori il pulsante legge «I miei
   difensori», non «I miei obiettivi». Chi lo tocca sa già cosa troverà.

## Cosa abbiamo scartato

**Tenere le fasce miste e filtrarle solo a schermo.** Era la strada corta, e non richiedeva di
toccare i dati. Ma avrebbe lasciato il problema della preparazione irrisolto, e avrebbe reso
possibile una fascia mezza difensori e mezza attaccanti: uno stato che nessuno vuole ma che il
modello permetteva.

**Cancellare le fasce esistenti e ricominciare.** La migrazione replica ogni fascia senza ruolo nei
quattro reparti e sposta ciascun calciatore nella copia del suo. Chi aveva «Da prendere
assolutamente» se lo ritrova quattro volte, con i nomi già al posto giusto. Nessuno paga il
cambiamento perdendo il lavoro fatto.

## Cosa ci portiamo dietro

- **Se una divisione conta al momento di usare i dati, deve contare al momento di crearli.** Un
  filtro a valle è un rattoppo su una struttura che non aveva pensato a quella divisione.
- **Quando due strutture parallele hanno regole diverse, una delle due ha torto.** Gli slot avevano
  il ruolo e le fasce no: era un'asimmetria senza motivo, non una scelta.
- **L'ha trovato di nuovo l'uso, non le prove.** Le trentaquattro prove sulla lista obiettivi erano
  verdi. Nessuna poteva accorgersi che una fascia mista sarebbe stata scomoda il giorno dell'asta.
  Vedi [fasce e slot sono alternativi](2026-09-03-fasce-e-slot-sono-alternativi.md): è la seconda
  volta di seguito.
