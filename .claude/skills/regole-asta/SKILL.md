---
name: regole-asta
description: Le regole del fantacalcio tradotte in controlli eseguibili, con i casi limite e i test obbligatori. Usala ogni volta che scrivi o modifichi qualcosa che tocca offerte, crediti, slot di rosa, turni o countdown.
---

# Regole d'asta, in forma di controlli

La descrizione completa sta in `docs/02-dominio-fantacalcio.md`. Qui c'è la forma operativa: cosa
controllare e cosa provare.

## Il calcolo del massimo offribile

```
slot_rimanenti    = slot_totali_previsti - calciatori_gia_acquistati
massimo_offribile = crediti_residui - (slot_rimanenti - 1) * offerta_minima
```

Questa funzione si scrive **una volta sola**, in `app/src/domain/rules.ts`, e viene importata sia
dall'interfaccia sia dal server. Due copie divergono, e quando divergono qualcuno resta con la rosa
incompleta.

## I controlli su ogni offerta, nell'ordine

Il server li esegue tutti prima di scrivere. L'interfaccia ne rispecchia alcuni per cortesia, ma
**la cortesia non è sicurezza**.

1. L'asta è aperta e non in pausa?
2. Il lotto esiste ed è ancora `open`?
3. Chi offre è un partecipante di quella lega, con una squadra?
4. In modalità con passo, non ha già passato su questo lotto?
5. L'importo è superiore all'offerta corrente, e almeno pari all'offerta minima se è la prima?
6. L'importo è entro il **massimo offribile** calcolato adesso, non quello di dieci secondi fa?
7. La squadra ha ancora uno slot libero per quel ruolo?
8. Nelle varianti per ruolo, il ruolo del calciatore è quello del reparto aperto?
9. Il calciatore non è già stato acquistato da qualcuno in quella lega?

Ogni rifiuto ha un messaggio che dice **cosa fare**, non solo cosa è andato storto.

| Rifiuto | Messaggio |
|---|---|
| Offerta superata | «Sei stato superato: ora siamo a 31. Rilancia?» |
| Oltre il massimo | «Puoi arrivare al massimo a 35: devi tenere 5 crediti per gli slot che ti restano.» |
| Ruolo pieno | «Hai già 3 portieri.» |
| Lotto chiuso | «Il calciatore è stato appena assegnato.» |

## Il ciclo del timer

```
attesa      finché  adesso - last_bid_at  <  secondi_inattivita
countdown   quando  adesso - last_bid_at  >= secondi_inattivita
chiusura    quando  adesso - countdown_started_at >= secondi_countdown
```

Ogni rilancio azzera `last_bid_at` e annulla il countdown in corso.

## Casi limite da provare sempre

Sono i casi che rompono l'asta davanti a dieci persone.

- [ ] Ultimo slot da riempire: il massimo offribile deve essere **tutti** i crediti residui.
- [ ] Squadra con 1 credito e 1 slot: può offrire 1, non 0.
- [ ] Squadra con crediti finiti e slot aperti: viene **saltata** nel giro delle chiamate.
- [ ] Offerta che arriva **nello stesso istante** in cui il countdown scade: o entra e azzera, o il
      lotto si chiude e l'offerta viene rifiutata. Mai entrambe.
- [ ] Due offerte identiche a millesimi di distanza: vince la prima, la seconda riceve un rifiuto
      comprensibile.
- [ ] Tutti passano tranne uno, in modalità con passo: il lotto si chiude subito, senza timer.
- [ ] Tutti i partecipanti hanno completato il reparto: il reparto avanza automaticamente.
- [ ] Rose tutte complete: l'asta si chiude da sola.
- [ ] Amministratore che annulla l'ultima aggiudicazione: crediti restituiti, slot liberato,
      calciatore di nuovo fra gli svincolati, evento registrato.
- [ ] Riconnessione a 2 secondi dalla fine: il telefono riprende da 2 secondi, non da capo.

## Cosa non deve mai succedere

- Un calciatore in due rose della stessa lega.
- Crediti residui negativi.
- Una squadra con più calciatori di uno stesso ruolo di quanti ne prevedono le regole.
- Un'aggiudicazione senza la riga corrispondente nel registro eventi.
- Crediti scalati senza il calciatore in rosa, o viceversa. Stessa transazione, sempre.
