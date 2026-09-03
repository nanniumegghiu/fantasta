# 06 · Sicurezza e accessi

**Scopo** · Stabilire chi può leggere e scrivere cosa, come funziona l'accesso, e come si gestiscono
i codici di invito e le credenziali.
**Proprietario** · security-officer, con potere di veto sulle consegne
**Stato** · 🟡 accesso, leghe, inviti, listone e **liste obiettivi** realizzati e verificati · asta 🔴
**Data** · 2026-09-02

---

## 1. Cosa fa

L'app è fatta per giocare fra amici, ma «fra amici» non significa «senza permessi». Anzi: il dato
più delicato di tutto il sistema è proprio la **lista obiettivi**, che deve restare invisibile agli
altri partecipanti. Se trapela, il gioco è finito prima di cominciare, ed è il tipo di guaio che
un'app deve rendere impossibile, non improbabile.

## 2. Come funziona

### 2.1 Accesso

Due strade, entrambe richieste dall'utente:

- **Google**, un tocco, nessuna password da ricordare. 🔴 Provider non ancora configurato: finché
  è spento il pulsante non compare, invece di comparire e fallire.
- **Email e password**, almeno 8 caratteri. ✅ Funzionante. La **conferma dell'indirizzo è
  disattivata** per la ragione spiegata in ADR-0009: il servizio di invio incluso manda 2 email
  all'ora, e con dieci amici che si registrano insieme non funzionerebbe.

Chi accede con Google e poi con la stessa email via password ritrova lo stesso profilo: l'identità è
l'indirizzo email.

> **Nessuna bugia all'utente.** La schermata di recupero password dice «se l'indirizzo esiste
> riceverai un'email» solo se l'email viene davvero inviata. Finché l'invio non è configurato e
> verificato, quella funzione resta **disattivata e dichiarata tale**, non finta.

### 2.2 Il codice di invito

L'amministratore genera un codice di sei caratteri, senza lettere ambigue, che si condivide su
WhatsApp insieme a un link. Chi apre il link ed è già registrato entra con un tocco; chi non lo è
viene portato alla registrazione e poi dentro la lega.

Difese previste:

| Rischio | Difesa |
|---|---|
| Qualcuno indovina un codice a forza bruta | Limite di tentativi per utente e per indirizzo di rete; codice a 6 caratteri su 32 simboli, oltre un miliardo di combinazioni |
| Chi è già dentro riapre il link | L'anteprima lo dice **prima**: nessuno rifà il giro d'ingresso, e non nasce una seconda squadra |
| Il codice gira in una chat sbagliata | L'amministratore può **rigenerarlo** o disattivarlo in qualsiasi momento |
| Entrano più persone del previsto | La lega ha un numero massimo di partecipanti: superato, il codice smette di funzionare |
| Qualcuno entra a asta iniziata | Con l'asta aperta gli inviti sono automaticamente bloccati |

### 2.3 La matrice degli accessi

Tutte le tabelle nascono con l'accesso **negato per impostazione predefinita**, e si aprono solo
dove serve.

| Dato | Chi legge | Chi scrive |
|---|---|---|
| Profilo utente | Chiunque condivida una lega con lui | Solo il proprietario |
| Lega e regole | I suoi partecipanti | Solo l'amministratore |
| Elenco partecipanti | I suoi partecipanti | Amministratore, più chi entra col codice |
| Squadra, nome e crediti | Tutti i partecipanti della lega | Il nome lo scrive il proprietario. **I crediti solo il server** |
| Rose, chi ha comprato chi | Tutti i partecipanti | Solo il server, come esito dell'asta |
| Listone e statistiche | Ogni utente autenticato | **Nessuno dalla tabella.** Solo le funzioni di importazione, che verificano di persona chi le chiama |
| Chi è amministratore dell'applicazione | Ognuno sa se lo è lui, nessuno sa chi altro lo è | Nessuno dall'app |
| **Lista obiettivi, fasce, slot, note** | **Solo il proprietario** | **Solo il proprietario** |
| Asta, stato e impostazioni | I partecipanti | Amministratore per le impostazioni, server per lo stato |
| Lotti e offerte | I partecipanti | Solo il server |
| Registro eventi | I partecipanti | Solo il server, e mai in modifica o cancellazione |
| PDF del regolamento | I partecipanti | Solo l'amministratore |
| Eliminazione della lega | — | Solo l'amministratore, **riscrivendo il nome della lega**. Nessuna policy di cancellazione sulla tabella: si passa solo dalla funzione |

> ⚠️ **L'amministratore non è un superutente.** Conduce l'asta, ma **non può leggere le liste
> obiettivi degli altri**. È la regola che rende l'app usabile fra amici: chi organizza non deve
> avere un vantaggio. Sta nelle policy del database, non solo nell'interfaccia.
>
> ✅ **Verificato il 2 settembre 2026.** Sette prove distinte con l'amministratore autenticato:
> lista, obiettivi con tetti e note, fasce, slot, incroci, candidati e membri degli incroci. Tutte
> hanno restituito zero righe. Sono in `scripts/verifica-obiettivi.mjs` e si rilanciano quando si
> vuole.

### 2.4 Lo schermo condiviso

Mostra solo dati pubblici della lega, ma resta dietro l'autenticazione: lo apre un partecipante,
tipicamente l'amministratore dal portatile. Non esiste un indirizzo pubblico dell'asta.

Sulla pagina dello schermo condiviso **non compare nessuna informazione privata**, nemmeno di chi
l'ha aperta: se l'amministratore proietta dal suo portatile, i suoi obiettivi non devono finire sul
televisore. Sono due pagine diverse, non la stessa pagina con un interruttore.

### 2.5 Le tre categorie di credenziale

| Categoria | Nel progetto | Dove sta | Come si revoca |
|---|---|---|---|
| **Pubblica** | Indirizzo del backend e chiave anonima | Può stare nel codice del browser: è progettata per quello. La protezione vera sono le regole di accesso, non la segretezza della chiave | Non serve |
| **Di sviluppo** | Password del database, token della riga di comando | Solo in `.env.local`, escluso dal versionamento | Dal pannello del servizio, in pochi secondi |
| **Di runtime privilegiata** | La chiave che scavalca ogni regola | 🔴 **In nessun file del progetto.** Vive solo dentro le funzioni server, iniettata dal servizio | Rotazione dal pannello |

Le credenziali si chiedono all'utente **una volta sola e in blocco**, con l'indicazione esatta di
dove trovarle, e non passano mai dalla chat.

### 2.6 Cosa non facciamo, e perché va detto

L'app è per amici e non ha pagine legali, come richiesto. Questo non toglie che raccolga indirizzi
email reali: se un domani dovesse uscire da quella cerchia, servirebbero. Sta scritto qui per non
doverlo riscoprire dopo.

## 2bis. I poteri dell'amministratore, e il loro contrappeso

L'amministratore di lega può correggere le rose di tutti: togliere un calciatore, cambiare il prezzo
pagato. Serve, perché un'asta senza modo di rimediare a un errore si blocca al primo errore. Ma è
anche uno che gioca, quindi il potere va bilanciato.

Il contrappeso non è un limite tecnico, è la **visibilità**:

| Difesa | Come è fatta |
|---|---|
| Motivo obbligatorio | Il server rifiuta una correzione senza motivo di almeno tre caratteri |
| Registro leggibile da tutti | `registro_asta`, con la policy di `auction_events`: la vede ogni partecipante della lega |
| Interventi distinti dal gioco | La colonna `manuale`, definita una volta in `evento_manuale` |
| Registro non riscrivibile | Il trigger della migrazione 0008: nessuno modifica o cancella, nemmeno chi amministra |
| Nome di chi ha corretto | `actor_user_id`, risolto nel nome visibile |

Il criterio: **non si toglie il potere a chi serve che ce l'abbia, si toglie la possibilità di
usarlo di nascosto.**

## 2ter. Da quando è online

L'indirizzo dell'app è pubblico, quindi chiunque lo trovi può **registrarsi**. È la scelta fatta, e
regge perché la registrazione non dà accesso a niente di privato:

| Cosa | Chi la vede |
|---|---|
| Il listone e le statistiche | Chiunque abbia fatto l'accesso |
| Una lega, le sue rose, la sua asta | Solo chi ci è entrato col codice di invito di sei caratteri |
| Le liste obiettivi | Solo il proprietario. Nemmeno l'amministratore |
| Il registro dell'asta e gli scambi | I partecipanti di quella lega |

Il codice di invito è la porta, ed è protetto dal limite sui tentativi che era già in piedi.

**La password degli amici di prova non sta più nel codice.** Era scritta in chiaro in
`scripts/amici-di-prova.mjs`, con la scusa che sono account finti su un dominio che non esiste. La
scusa reggeva finché l'app stava sul computer di casa: in un repository pubblico quella riga
diventava la chiave buona per entrare nella lega vera e rovinare un'asta. Adesso si genera al primo
uso e vive in `.env.local`, e una prova della suite controlla che non torni nel sorgente.

Il repository è stato controllato prima di renderlo pubblico: nessun valore di credenziale in
nessun commit, presente o passato. Solo i **nomi** delle variabili, in `.env.example`, con le
istruzioni per procurarsele.

## 2quater. L'unico punto in cui si vede una lega senza farne parte

Il codice per il televisore apre lo schermo condiviso **senza accesso**. È l'unica eccezione al
principio «si vede solo la lega di cui si fa parte», e per questo il confine non sta
nell'interfaccia: sta in **una funzione sola**, `schermo_tv`.

### Perché una funzione e non delle policy

L'alternativa era dare a un visitatore speciale il permesso di leggere auctions, auction_lots,
teams, roster_players, players, player_stats, club_logos. Sette tabelle, sette policy da scrivere
giuste, e ogni tabella che si aggiunge in futuro è un'ottava occasione di dimenticarsene.

Con una funzione il confine è enumerato: **quello che non è dentro quella funzione, da quel link
non si vede**, e per verificarlo si legge un file solo.

### Cosa quella funzione non restituisce

| Non c'è | Perché è la cosa che conta |
|---|---|
| Liste obiettivi, tetti di spesa, note | Sono private anche dall'amministratore |
| Indirizzi email | Il televisore è in salotto, e lo guardano tutti |
| Identificativi delle persone | Le squadre hanno un nome, e basta quello |

Metà delle diciotto prove verifica **assenze**: si prende la risposta intera come testo e si
controlla che una nota scritta apposta, un tetto di spesa e una chiocciola non compaiano per
nessuna strada.

### Il visitatore anonimo, e perché non allarga niente

La pagina entra da sola come utente anonimo. Non serve a leggere l'asta — quella la dà la funzione
col codice — ma a poter **firmare gli indirizzi delle immagini**, che stanno in archivi riservati a
chi usa l'applicazione. Senza, il televisore mostrerebbe le iniziali al posto delle facce, che è
proprio quello che sul grande schermo si voleva evitare.

Non allarga il perimetro: **la registrazione è già aperta a chiunque**, quindi chi volesse leggere
il listone o le immagini poteva già farlo creando un account. L'accesso anonimo toglie solo il
passaggio dell'email.

### Il codice scade

Dodici ore, che coprono una serata con abbondanza. Un link che non scade è un link che gira per
sempre. Uno per lega: rigenerarlo spegne il precedente, e l'amministratore può revocarlo subito.

## 3. File coinvolti

- `app/supabase/migrations/20260902120000_profili.sql` — profili e loro policy
- `app/supabase/migrations/20260902140000_leghe.sql` — leghe, partecipanti, squadre, inviti, archivio
- `app/supabase/migrations/20260902160000_ingresso_lega_con_esito.sql` — ingresso con esito
- `scripts/verifica-sicurezza.mjs` — 7 prove sui profili
- `scripts/verifica-leghe.mjs` — 30 prove su leghe, inviti, squadre e regolamento

## 4. Decisioni e perché

- **Negato per impostazione predefinita.** Una tabella che nasce aperta e va chiusa dopo resta
  aperta: qualcuno se ne dimentica sempre.
- **Policy nella stessa migrazione della tabella.** Impossibile creare una tabella senza permessi.
- **L'amministratore non vede le liste altrui.** Requisito di gioco, non solo di privacy.
- **I crediti li scrive solo il server.** Se il client potesse toccarli, l'asta sarebbe una finzione.

## Da sapere prima di intervenire

Ogni volta che aggiungi una tabella, la prova non è che l'app funzioni: è che **un utente diverso dal
proprietario riceva zero righe**. La verifica va fatta con una richiesta autenticata come l'altro
utente, e l'esito va mostrato. «Ho scritto la policy» non è una verifica.

## Aperto / TODO

- ✅ Limitatore sui codici di invito: dieci fallimenti in dieci minuti e ci si ferma. Verificato.
- ✅ Archivio del regolamento privato, con indirizzi firmati a scadenza. Verificato.
- 🔴 Invio email non configurato: conferma indirizzo e recupero password restano spenti, ADR-0009.
- ✅ Eliminazione della lega da parte del suo amministratore: realizzata e verificata, 11 prove.
  Porta via a cascata partecipanti, squadre, rose, asta, registro e liste obiettivi, e lascia in
  piedi persone e listone.
- 🟡 Un utente che amministra una lega non si può cancellare: il vincolo lo impedisce, perché nessuna lega deve restare senza amministratore. Va deciso cosa offrire a chi vuole andarsene.
- 🟡 Va deciso se l'amministratore può espellere un partecipante e cosa succede alla sua rosa.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.4 | 2026-09-03 | Eliminazione della lega: solo l amministratore, solo riscrivendo il nome, controllato dal server. |
| 1.3 | 2026-09-02 | Liste obiettivi: policy scritte e verificate violandole, compreso il caso dell amministratore di lega. |
| 1.2 | 2026-09-02 | Aggiunto l amministratore dell applicazione, distinto da quello di lega: solo lui carica il listone. |
| 1.1 | 2026-09-02 | Realizzate e verificate le policy di leghe, squadre, inviti e archivio del regolamento. La lettura dei profili si estende ai compagni di lega. |
| 1.0 | 2026-09-02 | Prima stesura. |
