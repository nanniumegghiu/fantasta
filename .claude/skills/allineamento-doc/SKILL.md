---
name: allineamento-doc
description: Checklist da eseguire prima di considerare chiusa qualsiasi modifica al codice, per verificare che la documentazione sia allineata a ciò che il codice fa davvero. Usala quando una fetta di lavoro sta per essere dichiarata finita, quando cambia lo schema dati, l'interfaccia o il comportamento di una funzione.
---

# Allineamento della documentazione

Una modifica non è finita quando il codice funziona. È finita quando chi arriva dopo, leggendo la
documentazione, capisce cosa fa davvero.

## La checklist

### 1. Stato reale

- [ ] Ogni funzione toccata ha lo stato corretto nel suo documento di area: 🔴 non implementato,
      🟡 parziale, ✅ fatto **e verificato**.
- [ ] ✅ si mette solo se esiste una prova mostrata, non se «dovrebbe funzionare».
- [ ] Non esiste nessuna funzione descritta come esistente che nel codice non c'è. Questa è la
      verifica più importante di tutte.

### 2. Fatto unico

- [ ] L'informazione aggiunta sta in **un** documento. Gli altri, al massimo, la collegano.
- [ ] Se hai copiato due righe da un altro documento, sostituiscile con un collegamento.

### 3. Glossario

- [ ] Ogni termine nuovo usato nel codice è definito in `docs/00-glossario.md`.
- [ ] Non hai introdotto un sinonimo di un termine che esiste già.

### 4. Sezione «File coinvolti»

- [ ] I percorsi elencati esistono davvero. Verificali, non ricordarli.
- [ ] I file nuovi sono stati aggiunti all'elenco.

### 5. Il perché

- [ ] Se hai preso una decisione non ovvia, è scritta in «Decisioni e perché».
- [ ] Se la decisione è rilevante e difficile da invertire, c'è un ADR in `docs/adr/`.

### 6. Aperto e TODO

- [ ] Ciò che hai lasciato indietro è scritto lì, non solo nella tua testa.
- [ ] Ciò che hai risolto è stato **tolto** da lì.

### 7. Changelog

- [ ] Il documento ha una riga nuova con data e cosa cambia.

### 8. CLAUDE.md

- [ ] Se è cambiato lo stato del progetto o il prossimo passo, la sezione corrispondente è
      aggiornata. È la prima cosa che chiunque leggerà nella prossima sessione.

## Come si scrive

- Il **perché**, non il cosa: il cosa si legge dal codice.
- Per chi arriva ora: niente «come deciso ieri», niente «come sappiamo».
- Frasi corte. Un'idea per frase.
- I numeri in tabella, non in mezzo alla prosa.

## Il blocco

Se la documentazione è indietro, il doc-supervisor blocca la consegna. Il blocco si scrive così:

> **Consegna bloccata.** `docs/05-asta-realtime.md` sezione 2.2 descrive il countdown come gestito
> dal server, ma `useCountdown.ts:34` lo calcola sul client. O si corregge il codice o si corregge
> il documento, ma non possono restare in disaccordo.
