# 02 · Regole di dominio del Fantacalcio Classic

**Scopo** · Descrivere in modo non ambiguo tutte le regole che l'app deve far rispettare: rose,
crediti, metodi d'asta, timer, vincoli sulle offerte. È la fonte unica: il codice le implementa,
non le reinventa.
**Proprietario** · backend-engineer (le regole vivono sul server)
**Stato** · ✅ tutte le regole di questo documento sono realizzate e verificate · scambi 🔴
**Data** · 2026-09-02

---

## 1. Cosa fa

Questo documento risponde a una sola domanda: **cosa è lecito e cosa no**. Ogni volta che il codice
deve decidere se un'offerta è valida, se un turno è finito, se una rosa è completa, la risposta è
qui. Se il codice e questo documento non concordano, è il codice ad avere torto.

## 2. Come funziona

### 2.1 Ruoli e composizione della rosa

Il Fantacalcio Classic usa quattro ruoli: **P** portiere, **D** difensore, **C** centrocampista,
**A** attaccante. La composizione standard è 3-8-8-6 per un totale di 25 calciatori, ma è
**configurabile per lega**: l'amministratore decide quanti slot per ruolo.

| Ruolo | Slot standard |
|---|---|
| Portieri | 3 |
| Difensori | 8 |
| Centrocampisti | 8 |
| Attaccanti | 6 |

Una rosa è **completa** quando ogni ruolo ha esattamente il numero di slot previsto. L'asta finisce
quando tutte le rose di tutte le squadre sono complete.

### 2.2 Crediti

Ogni squadra parte con lo stesso budget, deciso dalle regole di lega (predefinito 500). I crediti si
scalano al momento dell'aggiudicazione, mai prima: un'offerta in corso **non** blocca crediti.

### 2.3 Il massimo offribile, la regola che protegge dall'errore

L'utente ha chiesto due cose: che non si possa offrire più di quanto si ha, e che lo schermo mostri
quanto può spendere ogni chiamante al massimo. Sono la stessa regola, e non è banale.

Se una squadra ha 40 crediti e le mancano 6 giocatori, **non** può offrirne 40: resterebbe con
5 slot vuoti e zero crediti, e la rosa non si potrebbe più completare. Deve tenere da parte almeno
l'offerta minima per ciascuno degli slot restanti.

```
slot_rimanenti    = slot_totali_previsti - calciatori_gia_acquistati
massimo_offribile = crediti_residui - (slot_rimanenti - 1) * offerta_minima
```

Esempio: 40 crediti, 6 slot da riempire, offerta minima 1, quindi massimo offribile 35.

Nella **chiamata divisa per ruoli** il calcolo si applica al reparto in corso, ma il vincolo globale
resta: si prende il **minore** fra il tetto globale e i crediti che restano dopo aver accantonato
l'offerta minima per ogni slot ancora scoperto, di qualsiasi ruolo.

> 🔒 Questa regola è verificata **sul server** a ogni offerta. Il pulsante disabilitato sul telefono
> è cortesia, non sicurezza: un client modificato deve essere respinto dal database.

### 2.4 Vincolo di ruolo

Una squadra che ha già 3 portieri non può offrire su un portiere. Il server rifiuta l'offerta con un
messaggio esplicito, e l'interfaccia mostra lo slot pieno prima ancora che l'utente ci provi.

---

## 3. I metodi d'asta

L'amministratore sceglie **un metodo** e la sua **variante** prima di aprire l'asta. La scelta si
congela all'apertura: cambiarla a metà asta falsa la gara. Se proprio serve, l'asta si annulla e si
riapre, operazione tracciata nel registro eventi.

### 3.1 Asta a chiamata

A turno, seguendo un ordine, ogni partecipante nomina un calciatore e fa la prima offerta. Poi
partono i rilanci degli altri.

| Variante | Come funziona |
|---|---|
| **Per ruoli** (`per_ruolo`) | Compartimenti stagni: prima tutti i portieri fino a completare i reparti di tutti, poi i difensori, poi i centrocampisti, poi gli attaccanti. L'app impedisce di chiamare un calciatore di un reparto non ancora aperto. |
| **Totale** (`totale`) | Si può chiamare chiunque in qualsiasi momento. Nessun vincolo di reparto oltre agli slot già pieni. |
| **Ibrida** (`ibrida`) | Prima si completano i portieri di tutti, poi tutti i giocatori di movimento sono liberi. |

**Ordine di chiamata**: `prestabilito`, cioè l'amministratore ordina i partecipanti come sono seduti
al tavolo, oppure `sorteggiato`, cioè l'app estrae l'ordine e lo mostra a tutti. L'ordine gira in
modo circolare. Chi ha già completato il reparto in corso viene **saltato** automaticamente.

### 3.2 Asta in ordine alfabetico

Nessuno sceglie: l'app mette all'asta i calciatori dalla A alla Z. Due varianti: `per_ruolo`, prima
tutti i portieri dalla A alla Z e poi i difensori e così via, oppure `totale`, l'intero listone in
ordine alfabetico. Un calciatore che nessuno vuole viene **passato** e non torna.

### 3.3 Asta random

Come l'alfabetico, ma l'estrazione è casuale. Anche qui `per_ruolo` oppure `totale`.

> ⚠️ **Nota onesta sul random.** Un'estrazione casuale sull'intero listone, oltre 500 calciatori di
> cui la maggior parte non interessa a nessuno, produce decine di passaggi a vuoto. L'app prevede
> quindi un filtro opzionale del bacino di estrazione, per esempio solo calciatori sopra una certa
> quotazione oppure solo quelli presenti in almeno una lista obiettivi, deciso dall'amministratore
> prima dell'apertura. Senza filtro l'asta funziona lo stesso, ma è lunga.

### 3.4 Modalità di conduzione

| Modalità | Cosa cambia |
|---|---|
| **Da app** (`app`) | I partecipanti chiamano e rilanciano dal telefono. Il timer è attivo. L'aggiudicazione è automatica. |
| **Live** (`live`) | Si urla al tavolo come sempre e l'app fa da tabellone. L'amministratore registra chiamate e aggiudicazioni. Nessun timer automatico. |

### 3.5 Chiamata libera o con passo

| Tipo | Cosa cambia |
|---|---|
| **Libera** (`libera`) | Chiunque può rilanciare fino alla chiusura, anche dopo essere stato sopravanzato più volte. |
| **Con passo** (`con_passo`) | Chi dichiara passo su un lotto è **escluso da quel lotto** per sempre. Quando tutti hanno passato tranne uno, il lotto si chiude subito senza aspettare il timer. Il passo è irreversibile e va confermato. |

---

## 4. Il timer, solo in modalità da app

Due valori distinti, entrambi impostati dall'amministratore prima dell'asta:

| Parametro | Cosa fa | Predefinito |
|---|---|---|
| `secondi_inattivita` | Quanti secondi di silenzio dall'**ultimo rilancio** prima che parta il countdown finale. | 8 s |
| `secondi_countdown` | Durata del countdown finale, con suono e numeri grandi sullo schermo. | 5 s |

Il ciclo: ogni nuovo rilancio **azzera** l'attesa. Passati i secondi di inattività senza offerte
parte il countdown; se arriva un rilancio durante il countdown, questo si annulla e si torna
all'attesa. Se il countdown arriva a zero, il calciatore è **automaticamente assegnato** al miglior
offerente, i crediti vengono scalati e lo slot riempito.

> 🔒 Il tempo è misurato **dal server**, non dai telefoni. Se ognuno contasse per conto suo, un
> telefono con l'orologio indietro di due secondi vedrebbe un'aggiudicazione diversa dagli altri.
> Vedi `docs/05-asta-realtime.md`.

---

## 5. Poteri dell'amministratore durante l'asta

Sono visibili **solo nella sua vista personale**, mai sullo schermo condiviso.

| Potere | Quando si usa | Effetto |
|---|---|---|
| **Passa il calciatore** | Nessuno lo vuole. | Il lotto si chiude senza aggiudicazione. Nell'asta a chiamata il calciatore torna nel listone svincolati; nell'alfabetica e nella random è escluso dal giro corrente. |
| **Assegnazione rapida** | C'è un solo pretendente e non ha senso fare l'asta. | Assegna il calciatore a una squadra al prezzo indicato, controllando comunque crediti e slot. Registrato nel registro eventi come `quick_assign`. |
| **Annulla ultima aggiudicazione** | Errore di battitura, calciatore sbagliato. | Restituisce i crediti, libera lo slot, rimette il calciatore fra gli svincolati. Sempre tracciato. |
| **Metti in pausa e riprendi** | Pausa caffè. | Congela i timer per tutti. |

---

## 6. Scambi

Impostazione di lega: scambi **consentiti o no**, e scambi **con conguaglio in crediti** consentiti
o no. Uno scambio è una proposta fra due squadre che diventa effettiva solo con l'accettazione di
entrambe, e deve lasciare **entrambe le rose valide**, cioè con lo stesso numero di slot per ruolo,
e i crediti non negativi. 🔴 Non implementato: previsto dopo l'asta, vedi roadmap.

---

## 7. File coinvolti

🔴 Nessuno: il codice non esiste ancora. Quando esisterà:

- le regole numeriche in `app/src/domain/rules.ts`, condivise fra client e server;
- l'applicazione autoritativa nelle funzioni server dell'asta;
- i vincoli non aggirabili come `CHECK` e policy dentro le migrazioni.

## 8. Decisioni e perché

- **Le regole stanno in un punto solo.** Il calcolo del massimo offribile è scritto una volta e
  importato sia dall'interfaccia, per disabilitare i pulsanti, sia dal server, per rifiutare. Due
  copie divergono sempre.
- **Il metodo si congela all'apertura.** Permettere di cambiarlo a metà è una porta aperta a
  contestazioni fra amici, che è esattamente ciò che l'app dovrebbe evitare.
- **Il passo è irreversibile.** Se fosse annullabile non sarebbe un passo, sarebbe un'esitazione.

## Da sapere prima di intervenire

Il vincolo del massimo offribile al punto 2.3 è la regola più facile da sbagliare e la più visibile
quando è sbagliata: se la sbagli, qualcuno resta con una rosa incompleta a fine asta e la serata è
rovinata. Ogni modifica a quel calcolo va accompagnata da test sui casi limite: ultimo slot, un solo
credito residuo, reparto già completo.

## Aperto / TODO

- ✅ Filtro del bacino per l'asta random: realizzato come soglia sulla quotazione. Il filtro «solo
  i calciatori presenti in qualche lista obiettivi» è stato **scartato di proposito**, perché
  lascerebbe dedurre chi sta nelle liste altrui. Vedi
  `docs/decisioni/2026-09-03-filtro-random-e-liste-obiettivi.md`.
- 🟡 Composizione rosa diversa da 3-8-8-6: supportata dal modello, provata con 1-1-1-1 nelle
  verifiche, non con valori grandi e sbilanciati.
- 🔴 Gli scambi fra squadre restano da costruire.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.2 | 2026-09-03 | Tutte e sette le combinazioni di metodo e variante realizzate, più modalità live, chiamata con passo e poteri dell amministratore. |
| 1.1 | 2026-09-02 | Regole realizzate nel motore d asta e verificate sui casi limite. Solo chiamata libera totale, per ora. |
| 1.0 | 2026-09-02 | Prima stesura: ruoli, crediti, massimo offribile, metodi, timer, poteri admin. |
