# ADR-0010 · Come si legano le foto del facepack ai calciatori del listone

**Stato** · 🔶 SUPERATO da ADR-0011 il 2026-09-02 · era Accettato · **Data** · 2026-09-02 · **Decide** · l'utente, su raccomandazione del
backend-engineer

---

> **Questo ADR è superato.** La sua premessa, cioè che servisse un elenco esportato a mano da
> Football Manager, si è rivelata falsa: esiste un servizio pubblico che restituisce gli
> identificativi. Vedi `0011-ponte-automatico-tramite-fmref.md`. Il testo resta qui perché la storia
> delle decisioni vale quanto la decisione corrente, e perché l'abbinamento manuale che descrive
> resta la via di riserva.

---

## Contesto

L'utente possiede un facepack e un logopack per Football Manager 26. L'ispezione della cartella ha
dato questi numeri reali:

| Cosa | Quantità | Come sono nominati |
|---|---|---|
| Foto dei calciatori in `faces/` | 501.690 | `<identificativo FM>.png`, per esempio `1000042.png` |
| Ritratti piccoli in `iconfaces/` | 501.691 | stesso schema |
| Loghi dei club in `logos/clubs/normal/` | 80.568 | `<identificativo FM>.png` |
| Maglie in `kits/` | molte | `<identificativo FM>_home.png` |

I file `config.xml` presenti in ogni cartella sono stati letti: contengono **solo** mappature da
identificativo a percorso interno del gioco, nella forma

```xml
<record from="1000042" to="graphics/pictures/person/1000042/portrait"/>
```

Una ricerca della parola `name` nei 38 MB del config delle facce ha restituito **zero occorrenze**.

**Conclusione**: il facepack non contiene nomi. Gli identificativi sono quelli interni di Football
Manager e non hanno nessun rapporto con quelli del listone di Fantacalcio. Senza un ponte fra i due
mondi, le foto non sono associabili.

## Opzioni valutate

### A · Esportare da Football Manager un elenco con identificativo e nome

Football Manager ha una preferenza che rende visibili gli identificativi unici, e le schermate degli
elenchi si possono esportare.

**Pro** · Se l'identificativo compare fra le colonne esportabili, l'associazione diventa **automatica
e definitiva**: si fa una volta e vale per sempre, riusabile ogni stagione e per tutte le leghe.
**Contro** · Non è garantito che quella colonna sia esportabile, va provato. Se non lo fosse,
servirebbe uno strumento di terze parti che l'utente potrebbe non avere.

### B · Solo abbinamento manuale dentro Fantasta

Una schermata in cui si accosta la foto al calciatore.

**Pro** · Funziona sempre, senza dipendere da niente. Il lavoro resta salvato.
**Contro** · Seicento calciatori sono troppi da abbinare a mano. Realisticamente si coprono i primi
cento o duecento e il resto resta senza foto.

### C · Rinunciare alle foto dei calciatori

Solo i loghi delle venti squadre di Serie A, che sono venti identificativi.

**Pro** · Costa cinque minuti e funziona di sicuro.
**Contro** · Si perde l'effetto migliore dell'app.

## Decisione

**Opzione A come strada principale, opzione B come rete di sicurezza per ciò che resta scoperto.**

Il modello dati prevede quindi una tabella di corrispondenza `player_photo_map` che lega
l'identificativo del listone all'identificativo di Football Manager, con l'indicazione di **come**
la corrispondenza è nata: importata dall'elenco, dedotta dal nome, oppure confermata a mano. Le
corrispondenze confermate a mano non vengono mai sovrascritte da un'importazione successiva.

## Conseguenze

**Diventa più facile** · Ripetere l'operazione la stagione prossima: cambia il listone, la
corrispondenza per identificativo di Football Manager resta valida.

**Diventa più difficile** · Nulla, ma vanno rispettati due vincoli pratici scoperti misurando:

1. **Non si caricano 501.690 immagini.** Servono soltanto i calciatori del listone, circa
   seicento, più venti loghi. Il programma di importazione estrae solo quelli, li riduce a un
   quadrato di 160 pixel e li converte prima di caricarli. L'intero archivio finale pesa pochi
   megabyte invece di decine di gigabyte.
2. **Il facepack resta sul computer dell'utente** e non entra nel repository. È già escluso dal
   versionamento.

**Rischio dichiarato** · Se l'esportazione da Football Manager non contiene gli identificativi,
questa decisione decade e resta l'opzione B. In quel caso non si ripiega di nascosto: si scrive un
ADR nuovo che dice cosa è successo.

## Reversibilità

**Alta.** La tabella di corrispondenza è indipendente dal resto e le foto sono facoltative in ogni
schermata: senza foto l'app funziona, mostrando le iniziali sul colore del ruolo.
