---
name: verifica-sicurezza
description: Come dimostrare che una regola di accesso funziona davvero, invece di dichiararlo. Usala ogni volta che crei o modifichi una tabella, una policy o un permesso, e prima di dichiarare sicura qualsiasi cosa.
---

# Verificare i permessi, non dichiararli

«Ho scritto la policy» non è una verifica. La verifica è **provare a violarla e farsi respingere**,
mostrando l'esito.

## Il metodo, in quattro passi

### 1. Prepara due identità

Servono almeno due utenti veri nell'ambiente di sviluppo: il proprietario del dato e un estraneo.
Per le regole di lega serve anche un terzo: un partecipante della **stessa** lega che però non è il
proprietario. È il caso più realistico e quello che si dimentica più spesso.

### 2. Prova la lettura legittima

Autenticato come proprietario, leggi il dato. Deve arrivare. Se non arriva, la policy è troppo
stretta e l'app si romperà in modo misterioso.

### 3. Prova la violazione

Autenticato come l'altro utente, chiedi lo **stesso identificatore**. Il risultato deve essere
**zero righe**, non un errore di permessi: il dato non deve nemmeno risultare esistente.

Le tre prove che contano di più in questo progetto:

- [ ] Un partecipante prova a leggere la **lista obiettivi** di un altro. → zero righe.
- [ ] L'**amministratore** prova a leggere la lista obiettivi di un partecipante. → zero righe.
      L'amministratore non è un superutente.
- [ ] Un utente prova a modificare i **crediti** della propria squadra. → rifiutato: i crediti li
      scrive solo il server.

### 4. Mostra l'output

Nel messaggio di consegna va incollato il risultato reale delle richieste, non la descrizione. Una
riga che dice `rows: 0` vale più di un paragrafo.

## Prove aggiuntive per l'asta

- [ ] Offerta costruita a mano oltre il massimo offribile. → rifiutata dal server, non solo dal
      bottone disabilitato.
- [ ] Offerta su un lotto di una lega di cui non si fa parte. → rifiutata.
- [ ] Tentativo di inserire una riga nel registro eventi. → rifiutato: è a sola aggiunta dal server.
- [ ] Tentativo di modificare o cancellare una riga del registro eventi. → rifiutato.
- [ ] Ingresso in lega con un codice di invito sbagliato, ripetuto molte volte. → limitato.
- [ ] Ingresso con un codice valido ma ad asta già aperta. → rifiutato.

## Le tre categorie di credenziale

| Categoria | Dove può stare | Come si revoca |
|---|---|---|
| **Pubblica** — indirizzo del backend, chiave anonima | Anche nel codice versionato: è progettata per il browser | Non serve |
| **Di sviluppo** — password del database, token della riga di comando | Solo in `.env.local`, escluso dal versionamento | Dal pannello del servizio |
| **Di runtime privilegiata** — la chiave che scavalca tutto | 🔴 In nessun file del progetto | Rotazione dal pannello |

Prima di ogni consegna:

- [ ] `git status` non mostra file `.env` fra quelli da aggiungere.
- [ ] Nessuna credenziale è finita in chat.
- [ ] Nessun segreto compare nei log o nei messaggi di errore mostrati all'utente.

## Il veto

Se una di queste prove fallisce, il security-officer blocca la consegna. Il veto si motiva sempre
con: **quale dato**, **quale utente lo raggiunge**, **con quale richiesta**.
