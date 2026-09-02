# 04 · Frontend, design system e suoni

**Scopo** · Definire l'aspetto e il comportamento dell'interfaccia: colori, tipografia, animazioni,
suoni, e l'elenco completo delle schermate.
**Proprietario** · frontend-engineer
**Stato** · 🟡 token e componenti costruiti · schermate da 1 a 12 fatte, mai viste in un browser · asta 🔴
**Data** · 2026-09-02

---

## 1. Cosa fa

L'utente ha chiesto un'app «giovane e moderna, con colori accesi e bottoni animati». Questo
documento traduce quella frase in valori che si possono scrivere nel codice, e la vincola al logo
che è già in cartella, così che l'app e il marchio siano la stessa cosa.

## 2. Come funziona

### 2.1 La palette, presa dal logo

I colori non sono inventati: sono stati **estratti dai pixel di `brand/logo.png`** e sono i colori
dominanti reali del marchio.

| Nome | Valore | Uso |
|---|---|---|
| `--verde-notte` | `#082B1D` | Sfondo principale dell'app |
| `--verde-campo` | `#0E5739` | Superfici sollevate, schede, barre |
| `--verde-acceso` | `#449545` | Conferme, stati positivi, «obiettivo mio» |
| `--arancio` | `#F47918` | Azione principale: chiama, rilancia |
| `--arancio-caldo` | `#EB6517` | Stato premuto dell'arancio |
| `--oro` | `#F7C443` | Countdown, aggiudicazione, evidenze |
| `--oro-scuro` | `#D79426` | Bordi e ombre dell'oro |

Neutri: `--bianco #FFFFFF`, `--nebbia #E7EDE9`, `--fumo #9BB0A5`, `--carbone #0A1F16`.

Semantici: errore `#E5484D`, attenzione `--oro`, successo `--verde-acceso`, informazione `#3B9EFF`.

> **Tema scuro come predefinito.** Il logo nasce su fondo scuro e l'asta si fa la sera, spesso con
> un televisore acceso in una stanza in penombra. Il tema chiaro è previsto ma non prioritario.

### 2.2 Contrasto: il vincolo che i colori accesi mettono a rischio

Arancio e oro su fondo scuro funzionano; **testo bianco su arancio no**. Regola operativa: il testo
sopra `--arancio` e `--oro` è sempre `--carbone`, mai bianco. Ogni coppia colore-testo deve
raggiungere un rapporto di contrasto di almeno 4,5 a 1 per il testo normale e 3 a 1 per il testo
grande. 🟡 Da verificare con uno strumento di misura quando le schermate esisteranno: al momento è
una regola dichiarata, non ancora misurata.

### 2.3 Tipografia

Un carattere solo: **Inter**, scelto per le cifre a larghezza fissa che tengono fermo il countdown.
È geometrico, moderno e gratuito. I numeri dell'asta usano la variante a **cifre di larghezza fissa**, altrimenti il
countdown «balla» mentre scende da 10 a 9.

| Ruolo | Dimensione mobile | Dimensione schermo condiviso |
|---|---|---|
| Numero d'asta e countdown | 48 px | 180 px |
| Nome del calciatore in asta | 24 px | 96 px |
| Titolo di sezione | 20 px | 40 px |
| Testo corrente | 16 px | 28 px |
| Etichette e tabelle | 14 px | 24 px |

Lo schermo condiviso si guarda **da tre metri**: usa una scala tipografica sua, non quella del
telefono ingrandita.

### 2.4 Movimento

I bottoni animati devono aiutare, non distrarre.

| Elemento | Animazione | Durata |
|---|---|---|
| Bottone premuto | Scala a 0,96 e ombra che si accorcia | 120 ms |
| Rilancio accettato | Il numero sale con un rimbalzo corto | 240 ms |
| Nuova chiamata | La scheda del calciatore entra dal basso con una leggera rotazione | 320 ms |
| Countdown | Pulsazione a ogni secondo, il colore vira dall'oro al rosso sotto i 3 secondi | 1 s per ciclo |
| Aggiudicazione | Coriandoli brevi e il nome della squadra che ingrandisce | 900 ms |
| Cambio di schermata | Dissolvenza con scorrimento di 8 px | 180 ms |

**Rispetto delle preferenze di sistema.** Chi ha attivato la riduzione del movimento sul proprio
dispositivo riceve le stesse informazioni senza animazioni: nessun rimbalzo, nessun coriandolo,
solo cambi di stato immediati. Non è un dettaglio di gentilezza, è che le animazioni pulsanti
possono dare fastidio fisico a chi soffre di emicrania vestibolare.

### 2.5 Suoni

Solo sullo **schermo condiviso**. I telefoni restano muti: dieci telefoni che suonano insieme in
una stanza sono rumore, non informazione.

| Evento | Suono | Perché |
|---|---|---|
| Nuova chiamata | Fischietto corto | Fa alzare la testa a tutti |
| Rilancio | Tocco secco, tono che sale con l'importo | Si sente che il prezzo cresce |
| Partenza countdown | Tre note discendenti | Segnala che si sta chiudendo |
| Ultimi 3 secondi | Battito al secondo | Tensione |
| Aggiudicazione | Martelletto e coro breve | Chiude il momento |
| Reparto completato | Campanella | Segna il passaggio di fase |

> ⚠️ **Il vincolo tecnico da conoscere subito.** Nessun browser lascia partire un suono prima che
> l'utente abbia toccato la pagina. Lo schermo condiviso si apre quindi su una schermata «Tocca per
> attivare l'audio» con il logo grande: un tocco solo, all'inizio della serata, e per il resto
> l'audio funziona. Se non lo prevedessimo, i suoni semplicemente non partirebbero e sembrerebbe un
> difetto.

Il volume è regolabile e i suoni si possono spegnere del tutto dallo schermo condiviso.

### 2.6 Le schermate

**Accesso**

1. Accesso con Google oppure email e password.
2. Registrazione con nome mostrato.
3. Recupero password.

**Fuori dalla lega**

4. Le mie leghe: elenco delle leghe di cui sono membro o creatore, con lo stato di ciascuna.
5. Crea lega: nome, stagione, regole, caricamento del PDF del regolamento.
6. Entra in lega con il codice di invito.

**Dentro la lega**

7. Riepilogo lega: partecipanti, regole, regolamento in PDF, stato dell'asta.
8. La mia squadra: nome, rosa divisa per ruolo, crediti, spesa per reparto.
9. Rose degli avversari: tutte le squadre con crediti residui aggiornati.
10. Listone: tabella filtrabile per ruolo e squadra, ordinabile per ogni statistica, con foto.
11. **Lista obiettivi**, la schermata più ricca: fasce, tetti di spesa, slot, incroci portieri, note.
12. Impostazioni lega, solo amministratore: regole, partecipanti, codice di invito, apertura asta.

**Asta**

13. Vista personale dell'asta: calciatore in asta, mie informazioni su di lui, rilanci +1, +5, +10
    e libero, crediti, obiettivi residui, accesso rapido a rose e listone.
14. Vista amministratore dell'asta: la precedente più passa, assegna, annulla, pausa.
15. **Schermo condiviso**: la vista da proiettare, senza comandi, con i suoni.
16. Fine asta: riepilogo ed esportazione in CSV.

### 2.7 Struttura mobile

Si progetta a **360 px** e si sale. Barra di navigazione in basso con cinque voci: Asta, Rosa,
Listone, Obiettivi, Lega. Durante l'asta la barra resta sempre raggiungibile con il pollice, perché
l'utente ha chiesto esplicitamente di poter controllare rose e listone «in qualsiasi momento» senza
perdere l'asta: qualunque schermata si stia guardando, una fascia fissa in alto mostra chi è in asta
e a quanto, e riporta indietro con un tocco.

Punti di rottura: 360, 768 tablet, 1024 desktop, 1440 e oltre per lo schermo condiviso.

Area di tocco minima 44 x 44 px. I bottoni di rilancio sono più grandi: si premono di fretta.

## 3. File coinvolti

| File | Cosa contiene |
|---|---|
| `app/src/styles/index.css` | I token, presi dal logo, e le regole di base |
| `app/src/components/` | Bottone, Campo, CampoNumero, Interruttore, Intestazione, MarchioFantasta |
| `app/src/pages/` | Le schermate realizzate |
| `app/public/sounds/` | 🔴 non esiste ancora: i suoni arrivano con la Fetta 4b |

Il nome scritto **Fantasta** vive in un componente solo, `MarchioFantasta`: «Fant» in bianco e
«asta» in arancione, così la parola ASTA emerge dentro il nome. Scriverlo a mano nelle schermate
porterebbe prima o poi a tagliarlo nel punto sbagliato.

## 4. Decisioni e perché

- **Palette dal logo, non a piacere.** Il marchio esiste già: l'app deve sembrarne la continuazione.
- **Suoni solo sullo schermo condiviso.** Vedi sopra: è una scelta di comfort in una stanza reale.
- **Tema scuro predefinito.** Contesto d'uso serale e coerenza col logo.
- **Scala tipografica doppia.** Un'interfaccia leggibile a 30 cm non lo è a 3 metri.

## Da sapere prima di intervenire

I nomi dei calciatori italiani sono lunghi e le squadre pure. Ogni componente va provato con il nome
più lungo del listone, non con «Kean». I testi in italiano sono mediamente il 20% più lunghi degli
equivalenti inglesi: le etichette dei bottoni vanno verificate a 360 px.

## Aperto / TODO

- ✅ Carattere scelto: **Inter**, per le cifre a larghezza fissa che tengono fermo il countdown.
  Caricato da servizio esterno con ricaduta sui caratteri di sistema. Vedi
  `docs/componenti/app-web.md` per il dubbio ancora aperto sul portarlo dentro il progetto.
- 🔴 I file audio vanno prodotti o reperiti con licenza libera.
- 🟡 Contrasto dichiarato ma non ancora misurato.
- 🟡 Tema chiaro: previsto, non progettato.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.2 | 2026-09-02 | Schermate di listone, importazione e lista obiettivi. |
| 1.1 | 2026-09-02 | Carattere scelto, marchio diviso in due colori, primi componenti e schermate. |
| 1.0 | 2026-09-02 | Prima stesura, palette estratta dal logo reale. |
