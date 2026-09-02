# ADR-0008 · Formato del file di esportazione delle rose

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, che ha fornito le istruzioni
ufficiali

---

## Contesto

A fine asta ogni partecipante deve poter esportare la propria rosa, o tutte le rose, in un file che
l'app Fantacalcio sappia caricare. In `docs/07-dati-calciatori-facepack-export.md` questo punto era
segnato 🟡 con una dichiarazione esplicita: il formato non era noto e non volevo scriverlo a
memoria, perché un file che non si carica a fine asta manda all'aria la serata.

L'utente ha fornito le istruzioni ufficiali del caricamento rose.

## Decisione

Il file esportato è un foglio con **esattamente queste quattro intestazioni nella prima riga**:

| Intestazione | Contenuto | Obbligatoria |
|---|---|---|
| `Id` | Il codice numerico del calciatore nel listone ufficiale | Facoltativa ma consigliata |
| `Calciatore` | Cognome e nome, per esempio `Lautaro Martinez` oppure `Martinez L.` | Sì |
| `Fantasquadra` | Il nome esatto della squadra della lega a cui è assegnato | Sì |
| `Prezzo` | La cifra in fantamilioni spesa per acquistarlo | Sì |

**L'identificativo si include sempre.** È dichiarato facoltativo, ma è l'unica difesa contro le
omonimie, e in Serie A ce ne sono sempre. Esportare senza identificativo significa scoprire a
caricamento fatto che il portiere è finito nella rosa sbagliata.

Due modalità di esportazione, come richiesto:

- **la mia rosa**: solo le righe della squadra di chi esporta;
- **tutte le rose**: tutte le righe, distinte dalla colonna `Fantasquadra`.

Il nome nella colonna `Calciatore` è quello del listone importato, non uno normalizzato da noi:
l'app di destinazione confronta con lo stesso listone, quindi qualsiasi nostra rielaborazione può
solo peggiorare la corrispondenza.

## Conseguenze

**Diventa più facile** · Chiudere la Fetta 6 senza incertezze, e verificare l'esportazione con un
confronto colonna per colonna invece che a occhio.

**Diventa più difficile** · Nulla. Va però ricordato che il nome della fantasquadra deve
corrispondere **esattamente** a quello configurato nell'app di destinazione: l'interfaccia lo
segnalerà al momento dell'esportazione, perché è l'errore più probabile.

**Da verificare comunque** · Il formato è quello dichiarato dalle istruzioni ufficiali, ma
l'esportazione andrà provata con un caricamento vero prima di considerare chiusa la Fetta 6. Una
specifica letta non è un caricamento riuscito.

## Reversibilità

**Alta.** L'esportazione è un componente isolato: cambiare intestazioni o aggiungere un secondo
formato non tocca nient'altro.
