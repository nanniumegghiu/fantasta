# Registro · La prima asta vera, e le quattro cose che non andavano

**Data** · 2026-09-03 · **Chi** · l'utente, provando un'asta con compagni finti · **Realizza** · backend e frontend
**Dove** · migrazioni 0018 e 0019, schermo condiviso, pannello di conduzione

---

## Come ci siamo arrivati

Fino a oggi l'asta era verificata da cinquantasette prove lato server e non era mai stata **giocata**.
Mancava la cosa più banale: dei compagni di lega. Per questo è nato
`scripts/amici-di-prova.mjs`, che mette in lega account veri con cui provare da soli.

La prima partita ha prodotto quattro osservazioni. Nessuna di queste sarebbe mai uscita da una prova
automatica, perché nessuna riguarda una funzione che sbaglia: riguardano tutte come si sta dentro
una serata.

## 1. «Estrai il prossimo» dopo ogni chiusura

> «dover cliccare sempre estrai il prossimo è davvero antipatico e inutile»

Il difetto è più profondo di un pulsante di troppo. In un'asta a estrazione l'amministratore **non
conduce**: il server sceglie chi va all'asta e il timer decide quando finisce. Chiedergli un gesto
dopo ogni calciatore lo rimette al centro di una cosa che non ha bisogno di lui, e ogni volta la
stanza aspetta una persona invece di aspettare il gioco.

Adesso il lotto successivo si apre dentro la chiusura del precedente. Non vale per l'asta a
chiamata, dove il nome dopo lo dice una persona: lì l'attesa **è** il gioco.

Effetto collaterale da conoscere: in un'asta automatica c'è sempre qualcuno in asta, e
l'assegnazione rapida rifiuta giustamente di assegnare un calciatore mentre la stanza rilancia su un
altro. La via d'uscita è la pausa, che ferma la catena. È l'unica, quindi è provata.

## 2. La chiusura automatica lasciava le rose incomplete

Trovata mentre si sistemava la prima. L'asta si chiudeva appena non c'era più nessuno da estrarre —
e quel momento arriva **prima** che le rose siano piene, perché i calciatori che nessuno ha voluto
restano fuori e gli slot restano vuoti.

> «quando viene chiamata tutta la lista e finisce il primo giro di ogni ruolo ci deve essere la
> possibilità di aprire aste per giocatori cercati con ricerca nome dall'amministratore»

Due fatti che erano diventati la stessa risposta, e adesso sono separati: **rose complete** chiude
l'asta, **listone finito** la lascia aperta. Da lì l'amministratore ripesca i nomi per nome, compresi
quelli già passati — un calciatore passato non è rifiutato per sempre, è uno che a quel prezzo in
quel momento non interessava.

Siccome l'asta non si chiude più da sola in quel caso, adesso si può chiudere a mano. Il messaggio
dice quanti slot restano scoperti: chiudere con dei buchi è legittimo, ma va visto mentre lo si fa.

## 3. Lo schermo condiviso mostrava contatori invece di rose

> «si devono vedere le rose complete di tutti gli avversari complete di cifre di acquisto per ogni
> giocatore e crediti rimanenti sempre»

«D 5/8» dice quanto manca, non cosa c'è. La domanda vera, mentre qualcuno rilancia, è **chi ha già
preso quel ruolo e a quanto**: senza quel dato non si capisce se l'avversario sta completando un
reparto o togliendosi uno sfizio, e si offre alla cieca.

Due scelte non ovvie nel rifacimento:

- **Gli slot vuoti si vedono, tratteggiati.** Sono la cosa che a fine serata conta di più. E tenendo
  il numero di righe costante — sempre quante ne prevede il regolamento — la fascia non cambia
  altezza mentre le rose si riempiono. Su un televisore, un layout che balla per tre ore è peggio di
  qualche riga vuota.
- **I crediti stanno in cima a ogni colonna e non si muovono.** Sono il numero che si guarda più
  spesso e da più lontano: non deve mai essere cercato.

## 4. I comandi schiacciavano l'asta dell'amministratore

> «la visuale dell'amministratore privata è troppo sacrificata a causa dei comandi di gestione asta»

Chi conduce è anche uno che gioca. Il pannello occupava mezza schermata sempre, per pulsanti che si
usano tre volte in una serata.

La soluzione **non** è stato nascondere tutto. I comandi si dividono in due gruppi diversi: quelli
che risolvono il momento presente — aggiudica, passa, estrai — e quelli che si fanno di rado e con
calma. I primi restano sempre visibili, **uno alla volta**, quello che serve adesso; gli altri
stanno sotto una piega.

Nascondere anche l'azione del momento sarebbe stato più pulito da guardare e peggio da usare:
costringerebbe ad aprire un pannello ogni volta che la stanza aspetta una decisione.

## Cosa abbiamo scartato

**Aprire il prossimo lotto anche nell'asta a chiamata.** Sembra la stessa comodità, ed è il
contrario: lì il nome successivo è una decisione di una persona, e toglierla vorrebbe dire cambiare
il gioco.

**Lasciare che il riempimento scavalchi sempre il reparto in corso.** Aprire un attaccante in mezzo
ai portieri scavalcherebbe la regola della lega senza che nessuno l'abbia decisa. Si scavalca solo
quando quel reparto è finito davvero: allora non è una scorciatoia, è la ripresa.

## Cosa ci portiamo dietro

- **Cinquantasette prove verdi non dicono che una cosa si può usare.** Dicono che fa quello che le
  hai chiesto. È la quarta volta di fila in questo progetto che il difetto lo trova l'uso, dopo
  [fasce e slot](2026-09-03-fasce-e-slot-sono-alternativi.md),
  [il ruolo](2026-09-03-il-ruolo-e-la-prima-divisione.md) e
  [gli slot](2026-09-03-lo-slot-e-un-posto-non-una-casella.md). Il criterio da tenere: una funzione
  che nessuno ha ancora **usato** è 🟡, per quante prove abbia.
- **Costruire l'attrezzo per provare è parte del lavoro, non una deviazione.** Nessuna di queste
  quattro cose si poteva vedere senza sei squadre in lega. L'attrezzo per averle valeva più di
  qualunque altra prova scritta oggi.
- **Un gesto chiesto all'utente è un momento in cui il sistema si ferma.** Vale la pena chiederlo
  solo se in quel momento c'è davvero qualcosa da decidere.
