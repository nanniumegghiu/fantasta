# Registro · Il listone ha una stagione, e l'asta se n'era dimenticata

**Data** · 2026-09-03 · **Chi** · trovato mentre si metteva in sicurezza il listone · **Realizza** · backend
**Dove** · migrazione 0015, `prossimo_calciatore` e `chiama_calciatore`

---

## Cosa non funzionava

Il motore d'asta chiedeva soltanto se un calciatore fosse «in listone e non ancora comprato». Non si
chiedeva **di quale stagione**. Ogni lega dichiara la sua stagione quando viene creata, ma quel dato
non arrivava fino a chi pescava i nomi.

Finché nel database esiste un listone solo, la differenza non si vede. Appena ne convivono due, una
lega del 2026/27 può mettere all'asta un calciatore rimasto dal 2025/26.

## Come è saltato fuori

Non da una prova. È emerso mentre si sistemavano i danni raccontati in
[il listone cancellato dalle prove](2026-09-03-il-listone-cancellato-dalle-prove.md): per non toccare
più i dati veri, le prove sono passate a una stagione tutta loro, `PROVA`. A quel punto nel database
ci sono state due stagioni insieme per la prima volta, e il difetto è diventato visibile.

## Cosa abbiamo scelto

**Il filtro sta in chi legge, non in chi scrive.** L'importazione continua a ritirare i calciatori
mancanti **della stagione che si sta caricando**, e questo è giusto: caricare il listone nuovo non
deve cancellare la storia di quello vecchio. È l'asta che deve dire a quale stagione appartiene.

Due punti toccati:

- `prossimo_calciatore` pesca solo dalla stagione della lega, per tutte le varianti che estraggono.
- `chiama_calciatore` rifiuta un calciatore di un'altra stagione, e nel messaggio **nomina tutte e
  due le stagioni**. Se un giorno non combaciassero, chi legge deve capire subito qual è il
  disallineamento invece di trovarsi un rifiuto senza spiegazione.

## Cosa ci portiamo dietro

- **Un dato che esiste nel modello ma non arriva a chi decide è un difetto latente.** La stagione era
  su `leagues` e su `players` da sempre; nessuno le aveva mai messe in relazione.
- **Le prove isolate dai dati veri trovano cose che le prove sovrapposte nascondono.** Separare la
  stagione di prova non era una precauzione soltanto: ha reso osservabile un caso che prima non si
  poteva verificare.
