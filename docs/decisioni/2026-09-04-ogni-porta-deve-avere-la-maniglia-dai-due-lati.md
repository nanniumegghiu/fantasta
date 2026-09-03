# Registro · Ogni porta deve avere la maniglia dai due lati

**Data** · 2026-09-04 · **Chi** · l'utente, chiudendo un'asta per sbaglio · **Realizza** · backend e frontend
**Dove** · migrazioni 0027 e 0028, schermata dell'asta, schermata della lega

---

## Cosa è successo

L'utente ha premuto «chiudi l'asta» per sbaglio. Da quel momento la lega era ferma, e non c'era
niente da fare: nessun pulsante, nessuna funzione, nessun percorso alternativo.

> «mi trovo bloccato, non posso aprirne una nuova o sbloccare quella chiusa per errore»

Un'asta per lega è una sola. Chiusa quella, `apri_asta` rifiutava perché voleva lo stato `draft`, e
non esisteva niente che riportasse indietro. La schermata di fine asta mostrava una scritta e basta.

## Perché è il difetto peggiore trovato finora

Gli altri erano cose che funzionavano male. Questo era una cosa che **non si poteva riparare
dall'applicazione**. La differenza è enorme: davanti a un difetto normale l'utente aggira, riprova,
chiede; davanti a questo può solo fermarsi.

E la causa non era un errore di scrittura in una funzione. Era una **funzione mancante**, il che è
molto più difficile da vedere: `chiudi_asta` era scritta bene, provata, documentata. Semplicemente
non aveva il suo contrario.

## Cosa abbiamo capito

**Ogni azione che chiude una porta deve avere la maniglia anche dall'altro lato**, e la maniglia
deve stare **nel punto in cui ci si accorge di aver chiuso**. Non in un menù, non in una schermata
di amministrazione: lì, sulla stessa pagina che mostra la porta chiusa.

Il criterio si può applicare a tutto il resto guardando l'elenco delle azioni e chiedendosi, per
ognuna: «e se l'avesse premuta per sbaglio?».

| Azione | Il suo contrario |
|---|---|
| Chiudi l'asta | ✅ Riapri l'asta *(non c'era: aggiunto)* |
| Aggiudica | ✅ Annulla l'ultima aggiudicazione |
| Metti in pausa | ✅ Riprendi |
| Passa un calciatore | ✅ Rimettilo all'asta cercandolo per nome |
| Assegna senza asta | ✅ Togli dalla rosa |
| Elimina la lega | ❌ Nessuno, ed è voluto: chiede di riscrivere il nome apposta |

## Cosa abbiamo scelto

1. **`riapri_asta` sta nella schermata di fine asta**, dove si vede il danno. Non cancella niente:
   rose, crediti e registro restano.
2. **Chiede un motivo**, come le correzioni sulle rose. Riaprire un'asta chiusa cambia le regole a
   partita finita: in una lega fra amici va spiegato mentre lo si fa, non dopo. Finisce nel registro
   che leggono tutti.
3. **Non abbiamo aggiunto un «ricomincia da zero».** Sarebbe stato più potente e molto più
   pericoloso: cancellerebbe rose e crediti di tutti. Chi vuole ripartire davvero può eliminare la
   lega, che già chiede di riscriverne il nome. Un potere in più non serviva: serviva quello che
   mancava.

## La seconda cosa, arrivata con la prima

L'utente ha chiesto anche di poter togliere un partecipante **conservando la squadra**, e affidarla
poi a qualcun altro. È lo stesso problema con un'altra faccia: finora la persona e la squadra erano
la stessa cosa, e se uno lasciava il gruppo la sua rosa e i suoi crediti se ne andavano con lui.

`teams.user_id` è diventato facoltativo. Una squadra senza proprietario è uno stato legittimo e
temporaneo: la rosa c'è, i crediti ci sono, manca chi la guida. Tre scelte dentro questa:

- **Il nome della squadra non cambia** quando passa di mano. Quella rosa la conoscono tutti con quel
  nome, e cambiarlo a metà stagione renderebbe illeggibile il registro dell'asta.
- **La lista obiettivi se ne va con la persona.** Era sua e privata, e chi prende la squadra non
  deve trovarsi le preferenze di un altro.
- **L'amministratore non può togliere se stesso.** Una lega senza amministratore non ha più nessuno
  che possa rimediare a niente — che è esattamente il problema da cui è partito tutto.

## Il difetto che le prove hanno trovato dentro il difetto

`libera_squadra` non funzionava, e falliva in silenzio. Il motivo: un trigger vietava di cambiare
`user_id` a una squadra — «Squadra non trasferibile» — **a chiunque, server compreso**.

È la **quarta volta** che una difesa scritta senza distinguere chi sta scrivendo blocca il server
stesso: migrazione 0007 sui crediti, 0008 sul registro, 0017 sull'attore che si stacca, e adesso
questa. Vale la pena scriverlo come regola:

> **Una difesa che non guarda `current_user` prima o poi impedisce a noi quello che voleva impedire
> a loro.**

Il divieto resta identico per il client — dal browser una squadra non cambia mai mano, sarebbe il
modo più diretto di prendersi la rosa di un altro — e cade per il server, dove ci sono i controlli
che rendono quel passaggio legittimo.

## Cosa ci portiamo dietro

- **Una funzione mancante non la trova nessuna prova**, perché non c'è niente da provare. La trova
  solo l'uso, e la trova nel momento peggiore. L'unica difesa è la domanda: «e se l'avesse premuta
  per sbaglio?».
- **Uno stato senza uscita è peggio di un errore.** Un errore si legge e si aggira; un vicolo cieco
  ferma tutto e non spiega niente.
