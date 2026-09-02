# 06 · Sicurezza e accessi

**Scopo** · Stabilire chi può leggere e scrivere cosa, come funziona l'accesso, e come si gestiscono
i codici di invito e le credenziali.
**Proprietario** · security-officer, con potere di veto sulle consegne
**Stato** · 🟡 accesso, leghe, inviti e archivio del regolamento realizzati e verificati · asta 🔴
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

> ⚠️ **L'amministratore non è un superutente.** Conduce l'asta, ma **non può leggere le liste
> obiettivi degli altri**. È la regola che rende l'app usabile fra amici: chi organizza non deve
> avere un vantaggio. Va scritta nelle policy del database, non solo nell'interfaccia.

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
- 🟡 Un utente che amministra una lega non si può cancellare: il vincolo lo impedisce, perché nessuna lega deve restare senza amministratore. Va deciso cosa offrire a chi vuole andarsene.
- 🟡 Va deciso se l'amministratore può espellere un partecipante e cosa succede alla sua rosa.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.2 | 2026-09-02 | Aggiunto l amministratore dell applicazione, distinto da quello di lega: solo lui carica il listone. |
| 1.1 | 2026-09-02 | Realizzate e verificate le policy di leghe, squadre, inviti e archivio del regolamento. La lettura dei profili si estende ai compagni di lega. |
| 1.0 | 2026-09-02 | Prima stesura. |
