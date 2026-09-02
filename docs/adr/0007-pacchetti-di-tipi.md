# ADR-0007 · I pacchetti di soli tipi accompagnano il pacchetto che descrivono

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · frontend-engineer
**Estende** · ADR-0006, che resta valido e non viene modificato

---

## Contesto

ADR-0006 ha fissato un elenco chiuso di dipendenze. Alla prima compilazione reale è emerso un caso
che quell'elenco non aveva previsto: i **pacchetti di sole definizioni di tipo**, che non finiscono
nell'applicazione ma servono al controllo dei tipi durante lo sviluppo.

Concretamente, la configurazione di Vite usa `node:url` per risolvere l'abbreviazione `@/` nei
percorsi delle importazioni. Senza le definizioni di tipo di Node, la compilazione si ferma con:

```
vite.config.ts(5,36): error TS2307: Cannot find module 'node:url'
vite.config.ts(41,62): error TS2339: Property 'url' does not exist on type 'ImportMeta'
```

## Opzioni valutate

### A · Rinunciare all'abbreviazione dei percorsi

Usare solo percorsi relativi ed evitare `node:url` nella configurazione.

**Pro** · Nessun pacchetto in più.
**Contro** · Percorsi come `../../../components/Bottone` in tutta l'applicazione. Si rompono a ogni
spostamento di file ed è il tipo di attrito che porta a duplicare i componenti invece di spostarli.

### B · Aggiungere le definizioni di tipo di Node

**Pro** · Risolve il problema alla radice. **Non aggiunge nulla all'applicazione compilata**: è un
pacchetto di sole dichiarazioni, usato dal controllo dei tipi e scartato dalla compilazione.
**Contro** · Un pacchetto in più nell'elenco, che è esattamente ciò che ADR-0006 vuole tenere sotto
controllo.

## Decisione

**Opzione B**, con una regola generale che chiarisce ADR-0006 senza modificarlo:

> Un pacchetto di **sole definizioni di tipo** è autorizzato quando descrive un pacchetto o un
> ambiente di esecuzione già autorizzato, e a condizione che non finisca nel codice consegnato al
> browser.

Rientrano in questa regola, e sono quindi autorizzati:

| Pacchetto | Descrive |
|---|---|
| `@types/node` | L'ambiente Node usato dalla configurazione e dagli script |
| `@types/react` | `react`, autorizzato da ADR-0006 |
| `@types/react-dom` | `react-dom`, autorizzato da ADR-0006 |

## Conseguenze

**Diventa più facile** · Aggiungere le definizioni di tipo mancanti senza aprire un ADR ogni volta.

**Diventa più difficile** · Nulla. La regola è stretta: solo tipi, solo per pacchetti già
autorizzati.

**Controllo** · Lo script `npm run controlla-dipendenze` confronta i pacchetti realmente installati
con l'elenco autorizzato da ADR-0006 e da questo ADR, e segnala qualsiasi estraneo. Va eseguito alla
fine di ogni fetta.

## Reversibilità

**Alta.** Togliere `@types/node` richiederebbe solo di rinunciare all'abbreviazione dei percorsi.
