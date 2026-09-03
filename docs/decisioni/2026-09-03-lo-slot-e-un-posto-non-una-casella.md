# Registro · Lo slot è un posto della rosa, non una casella libera

**Data** · 2026-09-03 · **Chi** · l'utente, dopo aver provato la schermata · **Realizza** · backend e frontend
**Dove** · migrazione 0016, sezione slot della lista obiettivi, vista personale dell'asta

---

## Cosa non funzionava

Il metodo degli slot era stato costruito come un secondo modo di fare le fasce: contenitori che
l'utente crea quanti ne vuole, chiama come vuole, e dentro cui ogni calciatore porta il suo tetto
di spesa personale.

Sbagliato su due punti, e sono due punti diversi.

**La quantità.** Se puoi creare dodici slot in attacco, non stai preparando una rosa: stai facendo
un secondo elenco di preferenze, cioè le fasce con un altro nome. Le parole dell'utente: «devo avere
tanti slot per ruolo quanti previsti dal regolamento (3p, 8d, 8c, 6a)… posso modificare il nome
degli slot non la quantità».

**Il tetto.** Ripeterlo su ogni candidato è la stessa cifra scritta cinque volte. «Qui non inserisci
un prezzo massimo per ogni giocatore ma dichiari quanto sei disposto a spendere per un nome
qualsiasi presente in quello slot indicando un unico massimale.»

## Cosa abbiamo capito

I due difetti hanno la stessa radice: **uno slot non è un contenitore, è un posto**.

Se è un posto della rosa, la quantità non è una preferenza dell'utente, è un dato del regolamento.
E se è un posto, la domanda che gli fai non è «quanto vale questo nome», è **«quanto spendo per
riempire questo posto»**. I candidati che ci metti dentro valgono la stessa cosa per te: è
esattamente il motivo per cui li hai messi insieme, ed è quello che rende un massimale solo non una
semplificazione ma la risposta giusta.

Questo separa nettamente i due metodi, che prima si assomigliavano troppo:

| | Fasce | Slot |
|---|---|---|
| Cosa raggruppi | Nomi che valgono uguale | Nomi che possono occupare lo stesso posto |
| Quante ne fai | Quante vuoi | Quelle del regolamento |
| Dove sta il tetto | Sul nome | Sul posto |
| La somma dei tetti | Più del budget, ed è normale | **È** il budget della rosa |

L'ultima riga è la conseguenza più utile. Con le fasce gli obiettivi sono più di quelli che
comprerai, e sforare è la prova di avere delle alternative. Con gli slot i posti sono esattamente
quelli da riempire, uno a testa: la somma dei massimali è il piano di spesa vero, e se sfora il piano
non regge. La schermata lo dice con parole diverse nei due casi, perché sono due fatti diversi.

## Cosa abbiamo scelto

1. **La quantità viene dalla lega**, sempre. `sincronizza_slot` allinea gli slot al regolamento a
   ogni apertura della lista: se l'amministratore cambia le sue regole, gli slot si adeguano senza
   che nessuno debba accorgersene.
2. **Quando ne avanzano, va via il meno pieno**, a parità l'ultimo della fila. Qualcosa si deve
   perdere per forza, e questa è la scelta che salva più lavoro possibile.
3. **Il massimale sta sullo slot.** Nel metodo degli slot il tetto per calciatore non si mostra
   nemmeno. Ma il campo resta nei dati: serve alle fasce, e chi torna indietro ritrova quello che
   aveva scritto.
4. **La regola sta nei permessi, non nella schermata.** Sulla tabella l'utente può leggere e
   modificare due sole colonne, il nome e il massimale. Creare o cancellare uno slot dal client
   risponde 403, anche parlando direttamente col database con la chiave pubblica.
5. **Togliere un candidato lo toglie anche dalla lista**, se non occupa nessun altro posto. Con
   questo metodo un obiettivo esiste perché è candidato a un posto: staccarlo e lasciarlo lì
   produrrebbe un avanzo da togliere una seconda volta.
6. **All'asta il tetto arriva dal posto.** La vista personale nomina lo slot: «Il massimale di "il
   bomber": 90». Se il nome è candidato a più posti vale il più generoso, che è la cifra oltre la
   quale non ti serve più in nessun caso.

## Cosa abbiamo scartato

**Lasciare creare slot in più «per chi vuole più candidati».** Non serviva: i candidati dentro un
posto sono già illimitati. Chi voleva più slot voleva più nomi, e quelli si aggiungono senza
toccare la quantità dei posti.

**Cancellare i tetti per calciatore passando agli slot.** Sarebbe stato più coerente da vedere, e
avrebbe fatto pagare la prova a chi cambia metodo. Vale ancora quello che avevamo deciso in
[fasce e slot sono alternativi](2026-09-03-fasce-e-slot-sono-alternativi.md): cambiare metodo non
distrugge niente.

**Difendere la regola solo nell'interfaccia.** Sarebbe bastato non mettere il pulsante. Ma chi ha in
mano la chiave pubblica può parlare col database direttamente: se lì può creare uno slot, la regola
non esiste. Vale la regola non negoziabile numero 1, il server è l'unica autorità.

## Cosa ci portiamo dietro

- **Il nome di una cosa contiene le sue regole.** Finché lo chiamavamo «slot» genericamente,
  sembrava un contenitore. Chiamandolo «posto della rosa», la quantità fissa e il massimale unico
  vengono da soli.
- **Due metodi che si assomigliano troppo sono un metodo mal fatto.** Prima fasce e slot
  differivano quasi solo nel nome dei gruppi. Adesso rispondono a due domande diverse, e si sceglie
  fra loro sapendo perché.
- **È la terza volta di fila che il difetto lo trova l'uso.** Le prove erano verdi: verificavano che
  gli slot si creassero, non che dovessero.
