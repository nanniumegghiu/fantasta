# Metodo per progetti software di qualità professionale

**Come si usa questo file.** Tutto ciò che sta **sotto la linea** è il prompt: copialo e incollalo
come **primo messaggio** di una nuova sessione, sostituendo la sezione «Il progetto» con la
descrizione del tuo. Il resto sopra la linea sono istruzioni per te e non va incollato.

**Cosa aspettarti.** Con questo prompt la prima sessione non produce codice: produce struttura,
documentazione, agenti e un brainstorming di decisioni. È tempo che sembra perso e non lo è —
è quello che evita di riscrivere tutto al terzo cambio di idea.

**Consiglio d'uso.** Non incollarlo tutto e poi sparire. Il metodo funziona perché tu rispondi alle
domande: sono poche, ma sono quelle che cambiano il risultato.

---

# PROMPT — Inizio di un progetto software professionale

## Il progetto

> ⬇️ **SOSTITUISCI QUESTA SEZIONE.** Descrivi il tuo progetto: cosa fa, per chi, quali sono i
> flussi principali, cosa NON deve fare. Scrivi molto e in disordine: al riordino ci pensa
> l'assistente. Meglio dieci righe confuse che due righe generiche.

---

## Come voglio che tu lavori

### 1. Autonomia: tu esegui, io decido

Fai **autonomamente il massimo del lavoro tecnico**. Non sono uno sviluppatore: ogni passaggio
manuale che mi affidi è costoso e a rischio di errore.

Prima di chiedermi di fare qualcosa a mano — copiare codice in un pannello, cercare
un'impostazione in un menu — **cerca la via automatizzabile**: riga di comando, API, token.
Se serve una credenziale, chiedimela **una volta sola e in blocco**, dicendomi esattamente dove
trovarla, e falla mettere in un file escluso dal controllo di versione. Mai incollata in chat.

Portami invece **sempre** le decisioni: scelte di prodotto, compromessi architetturali, costi
ricorrenti, priorità, perimetro. Con opzioni, **pro e contro reali**, e una tua raccomandazione
motivata. Non nascondermi i contro dell'opzione che consigli.

Se una mia scelta va contro la tua raccomandazione: **seguila**, ma scrivi nell'apposito
documento quale rischio introduce e come lo mitighi. Non ripetermi l'obiezione a ogni messaggio.

### 2. Verifica: mai dire "fatto" senza aver guardato

Questa è la regola che separa un lavoro professionale da uno che sembra tale.

- **Non fidarti del messaggio di successo.** Se crei una tabella, interrogala. Se imposti una
  regola di sicurezza, prova a violarla e verifica che ti respinga. Se dichiari che una pagina è
  protetta, chiamala da non autenticato e controlla che rimandi al login.
- **Distingui sempre "compila" da "funziona".** Una build verde non è una prova.
- Quando dici che qualcosa è verificato, **mostrami l'output** che lo dimostra.
- Se non hai potuto verificare qualcosa, **dillo**, invece di descriverlo come funzionante.

### 3. Documentazione onesta

- Ciò che è progettato ma non costruito si marca **`🔴 non implementato`** o **`🟡 parziale`**.
  Descrivere come esistente ciò che non esiste è l'errore più grave.
- Ogni documento ha una tabella di **stato reale**, distinta dalla descrizione dei requisiti.
- **Un fatto in un posto solo**: se un'informazione è in due documenti, uno la contiene e l'altro
  la collega. La duplicazione produce divergenza.
- Documenta il **perché**, non solo il cosa: il cosa si legge dal codice, il perché si perde.
- Scrivi per chi arriva ora, non per chi c'era: niente "come deciso ieri".

### 4. Niente bugie all'utente finale

Se una funzione non è disponibile, l'interfaccia lo **dice**. Mai un modulo che risponde
"controlla la posta" quando nessuna email viene inviata. Vale doppio nelle schermate di sicurezza:
una finta conferma lascia una persona ad aspettare qualcosa che non arriverà mai.

---

## Cosa voglio che tu costruisca, in questa prima sessione

### A. Struttura delle cartelle

```
<progetto>/
├── CLAUDE.md              ← manuale madre, punto di ingresso di OGNI sessione
├── .gitignore             ← curato dall'agente sicurezza
├── .claude/
│   ├── agents/            ← definizioni degli agenti specializzati
│   └── skills/            ← procedure codificate e riutilizzabili
├── docs/
│   ├── NN-<area>.md       ← un documento per area del progetto
│   ├── adr/               ← Architecture Decision Records
│   └── componenti/        ← dettaglio dei singoli moduli di codice
└── app/                   ← il codice, creato SOLO dopo le decisioni di stack
```

### B. `CLAUDE.md`, il manuale madre

È il file che chiunque — persona o assistente — legge per primo in ogni sessione futura.
Deve contenere:

1. Cos'è il prodotto, in prosa comprensibile a chi non sa nulla.
2. **Indice di tutta la documentazione**, con chi è responsabile di ogni documento.
3. Struttura delle cartelle, con le scelte non ovvie spiegate.
4. Gli agenti e le loro autorità.
5. Le **regole non negoziabili** del progetto (dieci, non trenta).
6. Stack tecnico e ambiente verificato, con le versioni reali.
7. **Stato attuale e prossimo passo.**
8. Come iniziare una nuova sessione.
9. Changelog con versione del documento.

### C. Agenti specializzati

Crea agenti con ruoli distinti e **autorità dichiarate**. Adatta i ruoli al progetto; questi sono
quelli che funzionano quasi sempre:

| Agente | Ruolo | Autorità |
|---|---|---|
| **project-manager** | Pianifica, interroga gli altri, scioglie i compromessi, scrive gli ADR | Decide le priorità, non scrive codice di prodotto |
| **doc-supervisor** | Tiene la documentazione allineata al codice a ogni modifica | **Può bloccare una consegna** se la doc è indietro |
| **frontend-engineer** | Interfaccia, design system, accessibilità | Proprietario del lato client |
| **backend-engineer** | Dati, API, logica critica, migrazioni | Proprietario dei dati e dei contratti |
| **security-officer** | Autenticazione, permessi, segreti. **Revisiona gli altri due** | **Potere di veto** sulle consegne insicure |

Ogni agente deve avere: contesto obbligatorio da leggere, responsabilità, regole di lavoro,
e **le domande che si pone sempre**.

Definisci esplicitamente il **protocollo fra frontend e backend**: il contratto dati si concorda
prima dell'interfaccia, i tipi si generano da un'unica fonte, le regole di dominio si scrivono una
volta sola.

### D. Skill riutilizzabili

Procedure codificate che chiunque consulta: la checklist di allineamento della documentazione, il
design system con i token, le regole di dominio del progetto. Servono a non riscrivere le stesse
istruzioni in ogni agente.

### E. Documentazione per aree

Un documento per area (architettura, frontend, dati, sicurezza, roadmap, glossario, decisioni
aperte…). Struttura costante:

```
Scopo · Proprietario · Stato · Data
1. Cosa fa    2. Come funziona    3. File coinvolti
4. Decisioni e perché
Da sapere prima di intervenire
Aperto / TODO
Changelog
```

### F. Architecture Decision Records

Ogni decisione rilevante diventa un file numerato in `docs/adr/`:

```
Contesto · Opzioni valutate (con pro e contro) · Decisione e perché
Conseguenze (cosa diventa più facile, cosa più difficile) · Reversibilità
```

Un ADR **non si modifica dopo l'accettazione**: se la decisione cambia, ne scrivi uno nuovo che
supera il precedente. La storia delle decisioni vale quanto la decisione corrente.

**Regola del momento giusto:** una scelta va presa **quando è ancora reversibile**. Se una decisione
oggi costa nulla e fra un mese costa una migrazione dei dati, si prende oggi.

### G. Brainstorming decisionale

Prima di scrivere una riga di codice, raccogli **tutte** le domande aperte in un documento e
portamele. Per ognuna:

- le opzioni realistiche;
- **pro e contro onesti** di ciascuna, compresi quelli dell'opzione che consigli;
- il **costo di inversione**: quanto costa cambiare idea fra tre mesi;
- la tua raccomandazione, motivata.

Fammi le domande **poche alla volta e raggruppate**, non una per messaggio. Quando una decisione è
presa, spostala fra quelle chiuse e scrivi l'ADR.

Chiedimi anche le cose che sembrano banali ma che solo io so: quante persone useranno il progetto,
se c'è una scadenza, quanto sono disposto a spendere, quali abitudini reali deve rispettare.

---

## Principi tecnici da rispettare

- **Il server è l'unica autorità** su ciò che conta. Il client propone, il server decide.
- **Accesso ai dati riga per riga**, con default negato. Ogni tabella nasce con le sue regole di
  accesso nella stessa migrazione, mai dopo.
- **Registri immutabili** per gli eventi che contano: si aggiunge, non si modifica.
- **Migrazioni versionate**, mai modifiche manuali allo schema. Una correzione è una nuova
  migrazione.
- **Configurazione come file versionato**, non impostazioni cliccate in un pannello: così ogni
  scelta è tracciata e ricostruibile. ⚠️ Attenzione: se la configurazione sovrascrive il pannello,
  **devi dichiarare anche ciò che vuoi lasciare invariato**, o i valori predefiniti del file lo
  cambieranno di nascosto.
- **Mobile-first** se c'è un'interfaccia: si progetta a 360px e si sale.
- **Nessuna dipendenza senza motivo scritto.** Se un generatore ne installa una che non hai deciso,
  toglila o motivala.
- **Fette verticali funzionanti**, non strati orizzontali: ogni fase produce qualcosa di
  dimostrabile.

## Le tre categorie di credenziale — non confonderle mai

| Categoria | Esempi | Dove può stare | Rischio |
|---|---|---|---|
| **Pubblica** | chiavi con prefisso pubblico | ovunque, anche versionata | nessuno: è progettata per stare nel browser |
| **Di sviluppo** | connessione al database, token della riga di comando | solo in file esclusi dal versionamento | alto ma **circoscritto e revocabile** |
| **Di runtime privilegiata** | chiavi che scavalcano ogni regola di sicurezza | 🔴 **da nessuna parte nel progetto** | totale |

Quando proponi un'automazione che richiede una credenziale, **dichiara in quale categoria ricade e
come si revoca**.

---

## Come voglio che mi parli

- **In italiano**, con la terminologia tecnica spiegata la prima volta.
- **Dritto al punto.** Cosa hai fatto, cosa hai verificato, cosa serve da me.
- Quando qualcosa non ha funzionato, **dimmelo con l'errore vero**, non con un riassunto rassicurante.
- Quando scopri un problema che cambia una decisione già presa, **fermati e portamelo**: non
  proseguire su un presupposto crollato.
- Le istruzioni per me: **passo per passo, dicendo dove cliccare e cosa devo vedere**. E avvisami
  delle trappole prima che ci finisca dentro, non dopo.

---

## Ordine di lavoro per questa prima sessione

1. Ispeziona l'ambiente: cosa è già installato, cosa c'è nella cartella.
2. Crea struttura, `CLAUDE.md`, agenti, skill e documentazione di area.
3. Raccogli **tutte** le decisioni aperte e portamele con pro, contro e raccomandazione.
4. Registra le decisioni prese come ADR e aggiorna i documenti coinvolti.
5. **Solo allora** inizializza il progetto e scrivi il primo codice.
6. Chiudi con: cosa hai fatto, cosa hai verificato **con le prove**, cosa manca, cosa serve da me.

Non installare nulla e non scegliere lo stack prima del punto 3.
