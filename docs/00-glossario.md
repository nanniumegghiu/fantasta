# 00 · Glossario

**Scopo** · Fissare il significato di ogni parola usata nel progetto, così che codice, database e
interfaccia usino lo stesso termine per la stessa cosa.
**Proprietario** · project-manager
**Stato** · ✅ documento completo (descrive parole, non codice)
**Data** · 2026-09-02

---

## 1. Cosa fa

Quando in un progetto la stessa cosa si chiama in tre modi diversi, il codice diverge dalla
documentazione nel giro di due settimane. Questo file è l'autorità: se una parola è qui, si usa
questa e non un sinonimo, in italiano nell'interfaccia e in inglese nel codice.

## 2. Come funziona

Ogni voce ha: **termine italiano** (quello che vede l'utente) · **identificatore tecnico** (quello
che sta nel codice e nel database) · **definizione**.

### Persone e gruppi

| Termine | Nel codice | Definizione |
|---|---|---|
| Utente | `user` | Una persona registrata all'app. Esiste una volta sola, indipendentemente da quante leghe frequenta. |
| Lega | `league` | Il gruppo di amici che gioca insieme una stagione. Contiene regole, partecipanti, un'asta e delle rose. |
| Amministratore di lega | `league.admin_user_id` | Chi ha creato la lega. Ha poteri che gli altri non hanno: modifica le regole, apre e conduce l'asta, assegna e passa i giocatori. |
| Partecipante | `league_member` | Un utente dentro una lega specifica. È la riga che collega utente e lega. |
| Fantallenatore | — | Sinonimo colloquiale di partecipante. Si usa nei testi dell'interfaccia, mai nel codice. |
| Squadra fantacalcistica | `team` | La squadra di un partecipante dentro una lega: ha un nome scelto da lui, dei crediti e una rosa. |

### Calciatori e dati

| Termine | Nel codice | Definizione |
|---|---|---|
| Calciatore | `player` | Un giocatore reale della Serie A. Vive a livello globale, non dentro una singola lega. |
| Listone | `players` (la tabella intera) | L'elenco ufficiale di tutti i calciatori quotati della stagione. |
| Listone svincolati | vista `available_players` | Il listone **filtrato** sui soli calciatori non ancora acquistati in quella lega. È ciò che l'utente vede durante l'asta. |
| Ruolo | `role` | Uno fra `P` portiere, `D` difensore, `C` centrocampista, `A` attaccante. Il Fantacalcio Classic usa solo questi quattro. |
| Squadra di Serie A | `serie_a_team` | Il club reale di appartenenza del calciatore (Inter, Napoli…). Da non confondere con la squadra fantacalcistica. |
| Quotazione | `quotation` | Il prezzo di partenza ufficiale del calciatore nel listone. |
| Statistiche | `player_stats` | Partite giocate, minuti, media voto, fantamedia, gol, assist, ammonizioni, espulsioni, aggiornate all'ultima giornata completata. |
| Facepack | — | La raccolta di foto dei calciatori fornita dall'utente, caricata una volta e associata ai calciatori del listone. |

### Asta

| Termine | Nel codice | Definizione |
|---|---|---|
| Asta | `auction` | La sessione in cui i partecipanti si aggiudicano i calciatori. Una per lega, una per stagione. |
| Metodo d'asta | `auction.method` | Come si decide **quale calciatore** va all'asta: `chiamata`, `alfabetico`, `random`. |
| Variante | `auction.variant` | Come il metodo è suddiviso: `per_ruolo`, `totale`, `ibrida`. |
| Chiamata | `nomination` | L'atto di mettere all'asta un calciatore, con la prima offerta. |
| Lotto | `auction_lot` | Il singolo calciatore attualmente all'asta, con la sua storia di offerte. Aperto, aggiudicato o passato. |
| Offerta / Rilancio | `bid` | Una proposta di prezzo su un lotto aperto. |
| Passo | `pass` | Nella modalità *con passo*, la rinuncia definitiva a un lotto: chi passa non può più rilanciare su **quel** lotto. |
| Aggiudicazione | `award` | L'assegnazione del lotto a chi ha offerto di più, che scala i crediti e riempie uno slot di rosa. |
| Lotto passato | `lot.status = 'passed'` | Un calciatore che nessuno voleva: torna nel listone svincolati e potrà essere richiamato. |
| Assegnazione rapida | `quick_assign` | Potere dell'amministratore: dare un calciatore a una squadra a un prezzo, senza aprire l'asta, quando c'è un solo pretendente. |
| Crediti | `credits` | La moneta dell'asta. Ogni squadra parte con un budget uguale, deciso dalle regole di lega. |
| Crediti residui | `team.credits_remaining` | Quanto resta da spendere a una squadra. |
| Massimo offribile | `max_bid` | Il tetto reale di un'offerta: tiene conto dei crediti residui **e** degli slot ancora da riempire. Vedi `docs/02-dominio-fantacalcio.md`. |
| Schermo condiviso | vista `/lega/:id/asta/schermo` | La pagina proiettata sul televisore o sul monitor grande, uguale per tutti. Emette i suoni. |
| Vista personale | vista `/lega/:id/asta` | La pagina sul telefono di ciascuno, diversa per ognuno: da qui si rilancia. |

### Lista obiettivi

| Termine | Nel codice | Definizione |
|---|---|---|
| Lista obiettivi | `target_list` | La preparazione privata di un partecipante: chi vuole comprare e a quali condizioni. È **sua e invisibile agli altri**. |
| Obiettivo | `target` | Un calciatore dentro la lista, con le informazioni che il partecipante gli ha attaccato. |
| Fascia | `tier` | Un raggruppamento di obiettivi di valore equivalente. Il *Metodo delle Fasce*. |
| Tetto di spesa | `target.max_price` | Il prezzo massimo che il partecipante si è imposto per quell'obiettivo. Il *Metodo del Budget Massimo*. |
| Slot | `roster_slot` | Una casella della rosa ideale (es. «attaccante 1», «attaccante 4»), con i suoi candidati. La *Strategia degli Slot*. |
| Incrocio portieri | `goalkeeper_pairing` | Una coppia o terzetto di portieri scelti perché i loro calendari si alternano fra partite facili e difficili. |
| Obiettivi residui | — | Quanti obiettivi della lista sono ancora liberi. È il numero che l'utente vuole vedere sempre durante l'asta. |

## 3. File coinvolti

Nessuno ancora: 🔴 il codice non esiste. Quando esisterà, i nomi delle tabelle qui elencati saranno
in `app/supabase/migrations/` e i tipi TypeScript generati in `app/src/types/database.ts`.

## 4. Decisioni e perché

- **Interfaccia in italiano, codice in inglese.** Mescolare le due lingue dentro un identificatore
  (`squadraId`, `getRosa`) produce codice illeggibile. La traduzione avviene in un punto solo:
  i file di testo dell'interfaccia.
- **«Squadra» è ambigua e quindi vietata da sola.** Nel codice esistono solo `team` (la squadra
  fantacalcistica) e `serie_a_team` (il club reale). Nell'interfaccia si scrive per esteso.

## Da sapere prima di intervenire

Se aggiungi un concetto nuovo al progetto, aggiungilo **prima qui** e poi nel codice. Un termine che
compare nel codice senza essere in questo file è un debito che qualcuno pagherà.

## Aperto / TODO

- 🟡 I nomi delle colonne delle statistiche vanno confermati quando avremo il file reale del listone.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.0 | 2026-09-02 | Prima stesura. |
