---
name: contratto-dati
description: Il protocollo fra frontend e backend — chi decide cosa, come si concorda il contratto dati prima dell'interfaccia, come si generano i tipi da un'unica fonte. Usala prima di iniziare qualsiasi funzione che attraversi client e server.
---

# Protocollo fra frontend e backend

## L'ordine di lavoro, che non si inverte

1. **Il contratto dati si concorda prima dell'interfaccia.** Il backend dichiara quali dati esistono
   e con che forma; il frontend dice di cosa ha bisogno; ci si accorda; **solo allora** si disegna.
   Al contrario, l'interfaccia impone forme dei dati nate per comodità di una schermata, che poi
   restano per anni.
2. **I tipi si generano da un'unica fonte**, lo schema del database. Non si scrivono a mano. Un tipo
   scritto a mano si dimentica di essere aggiornato, e il compilatore smette di aiutarti proprio
   quando servirebbe.
3. **Le regole di dominio si scrivono una volta sola**, in `app/src/domain/`, e le importano
   entrambi i lati.

## Chi decide cosa

| Ambito | Decide |
|---|---|
| Forma dei dati, nomi delle colonne, migrazioni | backend-engineer |
| Quando e come una regola viene applicata | backend-engineer, sul server |
| Struttura dei componenti, stato del client, navigazione | frontend-engineer |
| Cosa deve essere visibile e in quanti tocchi | frontend-engineer |
| Chi può leggere cosa | security-officer, con veto |
| Cosa entra in questa fetta | project-manager |

## La regola che risolve la maggior parte delle discussioni

**Il client propone, il server decide.** Se un valore deve risultare uguale su dieci dispositivi
nella stessa stanza, lo calcola il server. Se il frontend chiede di calcolare qualcosa sul client
«perché è più veloce», la risposta è no ogni volta che quel qualcosa può differire fra due
telefoni: crediti, massimo offribile, secondi mancanti, esito di un'offerta.

Il client può calcolare liberamente ciò che è solo suo: filtri della tabella, ordinamenti,
espansione di una scheda, l'incrocio fra la lista obiettivi locale e il calciatore in asta.

## Come si chiede una modifica al contratto

Il frontend non modifica lo schema. Apre una richiesta scritta con tre righe:

> **Serve**: il massimo offribile di ogni squadra, aggiornato a ogni aggiudicazione.
> **Dove si mostra**: schermo condiviso, accanto a ogni nome.
> **Perché non lo calcolo io**: dipende dai crediti e dagli slot di tutti, e deve essere identico
> su tutti i dispositivi.

Il backend risponde con la forma concordata, ad esempio una vista `team_budget`, e la scrive in
`docs/03-modello-dati.md`. Poi si costruisce.

## Errori: un formato solo

Il server risponde agli errori sempre nella stessa forma: un codice stabile che il client può
riconoscere, e un messaggio in italiano già pronto da mostrare.

```
{ codice: 'OFFERTA_SUPERATA', messaggio: 'Sei stato superato: ora siamo a 31.' }
```

Il client **non compone** i messaggi di errore di dominio: se lo facesse, la stessa regola avrebbe
due formulazioni diverse a seconda di dove appare. Il client decide solo **dove** mostrarlo.

## Prima di dichiarare finita una funzione che attraversa i due lati

- [ ] I tipi sono rigenerati dallo schema, non modificati a mano.
- [ ] La regola di dominio è importata, non riscritta.
- [ ] Ogni errore possibile del server ha un messaggio previsto nell'interfaccia.
- [ ] Gli stati di caricamento, vuoto ed errore esistono.
- [ ] `docs/03-modello-dati.md` riflette la forma reale dei dati.
