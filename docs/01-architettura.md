# 01 · Architettura

**Scopo** · Spiegare com'è fatto il sistema nel suo insieme: quali pezzi esistono, chi parla con
chi, e dove si trova l'autorità su ogni decisione.
**Proprietario** · project-manager
**Stato** · 🟡 proposta in attesa della decisione sullo stack · vedi `docs/09-decisioni-aperte.md`
**Data** · 2026-09-02

---

## 1. Cosa fa

L'app serve un gruppo di amici che fa l'asta del fantacalcio seduto allo stesso tavolo. Questo
dettaglio, apparentemente banale, decide l'architettura: **ci sono tre superfici diverse che
guardano lo stesso stato nello stesso istante**.

| Superficie | Dove sta | Cosa mostra |
|---|---|---|
| **Schermo condiviso** | Un televisore o un portatile in mezzo al tavolo | Lo stato pubblico dell'asta: chi è stato chiamato, l'offerta corrente, il countdown, le statistiche, il massimo spendibile di ognuno. Emette i suoni. Non ha comandi. |
| **Vista personale** | Il telefono di ciascun partecipante | Gli stessi fatti più tutto ciò che è privato: i suoi rilanci, la sua lista obiettivi, le sue note sul calciatore in asta, la sua rosa. |
| **Vista amministratore** | Il telefono dell'amministratore | La vista personale più i poteri di conduzione: passa, assegna, annulla, pausa. |

Se queste tre superfici mostrano numeri diversi anche solo per un secondo, in una stanza dove tutti
si guardano in faccia, la discussione è immediata. La sincronia non è un dettaglio di qualità: è il
requisito principale.

## 2. Come funziona

### 2.1 Lo schema generale

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Schermo         │   │ Telefono di     │   │ Telefono        │
│ condiviso (TV)  │   │ ogni giocatore  │   │ amministratore  │
│  · solo lettura │   │  · rilanci      │   │  · conduzione   │
│  · suoni        │   │  · obiettivi    │   │                 │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └──────────── stesso canale realtime ───────┘
                               │
                    ┌──────────▼───────────┐
                    │  BACKEND (autorità)  │
                    │  · database          │
                    │  · regole di accesso │
                    │  · motore d'asta     │
                    │  · timer del server  │
                    │  · archivio file     │
                    └──────────────────────┘
```

### 2.2 Il principio che regge tutto: il client propone, il server decide

Nessuna azione che conta viene calcolata sul telefono. Il telefono dice **«voglio offrire 35»**; è
il server a stabilire se 35 è lecito, se lo slot è libero, se il lotto è ancora aperto, e solo
allora scrive. Il risultato torna a tutti dallo stesso canale.

Questo vale in modo particolare per **il tempo**. Il countdown non è un `setInterval` sul telefono:
il server registra l'istante dell'ultimo rilancio, e ogni superficie calcola quanti secondi mancano
rispetto a quell'istante. Così tutti vedono lo stesso numero anche se un orologio è sfasato, e chi
ricarica la pagina a tre secondi dalla fine riprende esattamente da tre secondi.

### 2.3 I quattro blocchi del backend

| Blocco | Responsabilità |
|---|---|
| **Database** | Verità persistente: leghe, squadre, calciatori, lotti, offerte, obiettivi. |
| **Regole di accesso riga per riga** | Ogni riga sa chi può leggerla. La lista obiettivi di Marco non è leggibile da Luca nemmeno con una richiesta costruita a mano. Default: negato. |
| **Motore d'asta** | La logica che nessuno può aggirare: validazione delle offerte, aggiudicazione, avanzamento del turno, scadenza del countdown. |
| **Archivio file** | PDF del regolamento, foto del facepack, file del listone caricati. |

### 2.4 Il registro eventi

Ogni cosa che succede durante l'asta finisce in un registro **a sola aggiunta**: chiamata, offerta,
passo, aggiudicazione, assegnazione rapida, annullamento. Non si modifica e non si cancella.

Serve a tre cose concrete: ricostruire l'asta se qualcuno contesta un'aggiudicazione, riallineare
una superficie che si è disconnessa, e alimentare lo storico che lo schermo condiviso mostra durante
i momenti morti.

### 2.5 Perché una applicazione web installabile e non un'app da store

Proposta, non ancora decisa. Una applicazione web moderna installabile sulla schermata iniziale
copre tutti e tre gli usi con un codice solo: il telefono di ognuno, il televisore, il portatile
dell'amministratore. Si condivide con un link su WhatsApp, esattamente come il codice di invito, e
si aggiorna senza che nessuno debba scaricare niente in mezzo a un'asta. I limiti reali sono due:
le notifiche push su iPhone funzionano solo se l'app è stata installata sulla schermata iniziale, e
il suono richiede un primo tocco dell'utente prima di poter partire. Entrambi sono gestibili e
documentati in `docs/04-frontend-e-design.md`.

## 3. File coinvolti

🔴 Nessuno: il codice non esiste ancora. La struttura prevista è descritta in `CLAUDE.md`.

## 4. Decisioni e perché

| Decisione | Stato |
|---|---|
| Il server è l'unica autorità su offerte, tempo e aggiudicazioni | Presa, non negoziabile |
| Registro eventi immutabile | Presa |
| Tre superfici distinte sullo stesso stato | Presa, viene dai requisiti |
| Quale backend concreto | 🔴 Aperta, vedi `docs/09-decisioni-aperte.md` |
| Applicazione web installabile o app nativa | 🔴 Aperta |

## Da sapere prima di intervenire

La tentazione ricorrente sarà spostare un calcolo sul client «tanto è più veloce». Ogni volta che lo
fai, introduci la possibilità che due telefoni nella stessa stanza mostrino numeri diversi. Se un
valore deve essere uguale per tutti, lo calcola il server.

## Aperto / TODO

- 🔴 Scelta dello stack, dopo la quale questo documento va riscritto con i nomi reali dei servizi.
- 🟡 Comportamento in caso di connessione assente al tavolo, per esempio internet che salta a metà
  asta. Va deciso se serve una modalità di ripiego.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.0 | 2026-09-02 | Prima stesura, indipendente dallo stack. |
