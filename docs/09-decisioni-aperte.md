# 09 · Decisioni aperte

**Scopo** · Raccogliere tutte le scelte che non posso prendere da solo, con opzioni, pro e contro
onesti, costo di inversione e la mia raccomandazione motivata. Quando una decisione è presa si
sposta fra quelle chiuse e diventa un ADR in `docs/adr/`.
**Proprietario** · project-manager
**Stato** · 🟡 5 decisioni chiuse con ADR, 7 ancora aperte
**Data** · 2026-09-02

---

## Come leggere questo documento

Per ogni decisione trovi il **costo di inversione**: quanto costa cambiare idea fra tre mesi. Le
decisioni con costo alto vanno prese ora, quelle con costo basso si possono rimandare senza danno.

---

## D1 · Quando è la tua asta? — ✅ CHIUSA

> **Risposta: oltre 6 settimane.** Nessuna pressione di calendario: si segue la roadmap intera
> nell'ordine previsto, facepack compreso, e si chiude con il ciclo di revisione iper-critica prima
> di usare l'app sul serio. Il testo qui sotto resta come traccia di come è stata posta la domanda.

**Perché lo chiedo** · Oggi è il 2 settembre 2026. Se la tua asta è fra due settimane, questa
roadmap non regge e va tagliata: si costruisce solo il metodo d'asta che userete voi, si rinuncia
al facepack e alle varianti, e si accetta che la prima serata sia una prova sotto pressione. Se
invece l'asta è fra un mese o è già passata e puntiamo alla stagione prossima, si costruisce bene.

| Opzione | Conseguenza |
|---|---|
| Entro 2 settimane | Solo fetta 0, 1, 2, 4a, 4b e il vostro metodo. Niente facepack, niente varianti, niente export. Rischio alto. |
| 3-6 settimane | Fette 0-4 complete più export. Facepack se avanza tempo. |
| Nessuna scadenza | Roadmap intera nell'ordine previsto, con la revisione QA finale. |

**Raccomandazione** · Nessuna: solo tu sai la data.
**Costo di inversione** · Nullo, ma sapere tardi costa tantissimo.

---

## D2 · Su cosa gira il backend — ✅ CHIUSA, vedi ADR-0001

> **Scelta: Supabase.** Motivazioni, contro accettati e conseguenze in
> `docs/adr/0001-backend-supabase.md`.

Il pezzo che deve tenere insieme dieci telefoni in tempo reale, custodire le liste obiettivi e far
rispettare le regole d'asta.

### Opzione A — Supabase *(raccomandata)*

Database PostgreSQL gestito, autenticazione con Google e email già pronte, canale realtime,
archivio file, funzioni server.

**Pro** · Database relazionale vero: le regole del fantacalcio sono relazioni, e in SQL si esprimono
in modo naturale. Sicurezza riga per riga scritta nel database, esattamente il modello che serve per
tenere segrete le liste obiettivi. Migrazioni versionate in file di testo, come chiede il metodo.
Archivio file incluso, quindi PDF e facepack senza servizi aggiuntivi. Piano gratuito sufficiente
per dieci amici. Si può portare via tutto: è Postgres standard.

**Contro onesti** · Il piano gratuito **mette in pausa il progetto dopo una settimana di
inattività**: alla prima apertura dopo la pausa ci sono alcuni secondi di attesa. Fastidioso se
succede la sera dell'asta, quindi si scalda prima. Il canale realtime ha un limite di messaggi al
secondo sul piano gratuito, ampio per dieci persone ma non infinito. Le funzioni server richiedono
uno strumento a riga di comando in più da installare.

**Costo** · 0 euro al mese. Il piano a pagamento costa circa 25 dollari al mese e toglie la pausa,
ma non serve.

### Opzione B — Firebase

Database a documenti di Google, autenticazione, sincronizzazione realtime molto matura.

**Pro** · Il realtime è il suo mestiere da quindici anni ed è eccellente. Accesso con Google
banale, è la stessa azienda. Nessuna pausa per inattività.

**Contro onesti** · Non è relazionale: «tutte le squadre della lega X con crediti residui e slot
mancanti per ruolo» diventa una gimcana di letture, oppure obbliga a duplicare dati e a tenerli
allineati a mano. Le regole di sicurezza sono un linguaggio a parte, meno espressivo di SQL proprio
sui casi che ci servono. **Nessuna migrazione versionata**: lo schema è quello che il codice scrive,
e il metodo che hai scelto chiede l'opposto. Si paga a lettura: uno schermo condiviso che ascolta
tutta l'asta genera molte letture, e il conto è difficile da prevedere.

### Opzione C — Backend proprio su un server

Node con Postgres e WebSocket su una macchina noleggiata.

**Pro** · Controllo totale, nessun limite imposto da altri.

**Contro onesti** · Devi mantenere un server: aggiornamenti, certificati, copie di sicurezza,
sorveglianza. Costo fisso di 5-10 euro al mese anche a giugno quando l'app non la usa nessuno.
Autenticazione e archivio file da costruire a mano, cioè settimane di lavoro per riottenere ciò che
le altre due danno il primo giorno. Per un'app usata da dieci amici una sera all'anno è sproporzionato.

**Raccomandazione** · **Opzione A, Supabase.** È l'unica che dà insieme il modello relazionale che
questo dominio chiede, la sicurezza riga per riga necessaria a proteggere le liste obiettivi, e le
migrazioni versionate richieste dal metodo. Il contro vero, la pausa per inattività, si aggira
aprendo l'app un'ora prima dell'asta.

**Costo di inversione** · **Alto.** Cambiare backend a metà significa riscrivere accesso ai dati,
sicurezza e realtime. È la decisione da prendere adesso.

---

## D3 · Applicazione web installabile o app da scaricare — ✅ CHIUSA, vedi ADR-0002

> **Scelta: applicazione web installabile.** Vedi
> `docs/adr/0002-applicazione-web-installabile.md`.

### Opzione A — Applicazione web installabile *(raccomandata)*

Un sito moderno che si aggiunge alla schermata iniziale del telefono e si comporta come un'app.

**Pro** · Un codice solo per telefoni, tablet, portatile e televisore. Si condivide con un link su
WhatsApp, la stessa strada del codice di invito. Aggiornamenti immediati per tutti: se scopri un
problema durante l'asta, lo correggi e tutti hanno la versione nuova ricaricando. Nessun negozio,
nessuna attesa di approvazione, nessun account sviluppatore da 99 euro l'anno per Apple.

**Contro onesti** · Le notifiche push su iPhone funzionano solo dopo che l'app è stata aggiunta alla
schermata iniziale, e vanno spiegate all'utente. Il suono richiede un tocco iniziale, per questo lo
schermo condiviso si apre con una schermata di attivazione. Nessuna icona nel negozio delle app.

### Opzione B — App nativa con React Native

**Pro** · Suoni e vibrazione senza compromessi, notifiche piene su entrambi i sistemi, sensazione
nativa.

**Contro onesti** · Serve comunque una versione web per il televisore, quindi due superfici da
mantenere. Distribuzione su iPhone solo tramite TestFlight, che scade ogni 90 giorni, o tramite
l'App Store con revisione e 99 euro l'anno. Ogni correzione richiede una nuova pubblicazione: se
un difetto salta fuori la sera dell'asta, non lo correggi in tempo. Molto più lavoro per lo stesso
risultato funzionale.

**Raccomandazione** · **Opzione A.** Il vantaggio decisivo non è tecnico ma pratico: durante una
serata d'asta la possibilità di correggere e ricaricare vale più di qualunque rifinitura nativa.

**Costo di inversione** · **Medio.** La logica di dominio e il backend si riusano; si rifà
l'interfaccia. Passare a nativo più avanti è possibile.

---

## D4 · Da dove arrivano listone e statistiche — ✅ CHIUSA, vedi ADR-0003

> **Scelta: importazione di un file**, con la struttura pronta per un aggiornamento automatico
> futuro. Vedi `docs/adr/0003-listone-importazione-manuale.md`.

### Opzione A — Importazione manuale di un file *(raccomandata)*

Scarichi il file ufficiale delle quotazioni e delle statistiche e lo carichi nell'app.

**Pro** · Sempre il listone giusto, quello della tua lega. Nessuna dipendenza da servizi che
possono cambiare o smettere di funzionare. Nessuna zona grigia sui termini d'uso. Funziona anche
senza internet al momento dell'asta.

**Contro onesti** · È un passaggio manuale, e il metodo che hai scelto dice di evitarli. Le
statistiche restano ferme finché non ricarichi il file. Se durante la stagione vuoi i dati
aggiornati, devi ricordartene tu.

### Opzione B — Raccolta automatica da fonte pubblica

Un programma che legge i dati da un sito e li salva.

**Pro** · Sempre aggiornati senza fare niente.

**Contro onesti** · Si rompe quando il sito cambia una riga di codice, e la legge di Murphy dice
che succede la settimana dell'asta. Le condizioni d'uso dei siti di fantacalcio in genere vietano
la raccolta automatica: per un'app fra amici il rischio pratico è nullo, ma va detto. E ti fa
dipendere da qualcosa che non controlli in un momento in cui non puoi permettertelo.

### Opzione C — Ibrida

Importazione manuale come base garantita, più un aggiornamento automatico che, se funziona, migliora
le statistiche, e se non funziona non rompe niente.

**Raccomandazione** · **Opzione A per l'asta, con la struttura pronta per la C.** L'importazione
manuale la fai una volta e sei sicuro che la sera dell'asta i dati ci sono. Il caricamento sarà
comunque automatizzato al massimo: trascini il file, l'app fa il resto e ti mostra cosa ha capito.

**Costo di inversione** · **Basso.** Aggiungere l'aggiornamento automatico dopo non cambia nulla del
resto.

---

## D5 · Come si chiama l'app — ✅ CHIUSA, vedi ADR-0004

> **Scelta: Fantasta.** Nessuna delle quattro proposte: il nome è dell'utente. Vedi
> `docs/adr/0004-nome-prodotto-fantasta.md`.

Il logo non contiene testo, quindi il nome è libero. Serve adesso perché finisce nel nome della
cartella, del progetto e dell'indirizzo web.

| Proposta | Perché |
|---|---|
| **Asta Master** | Diretto, dice cosa fa |
| **Fantabanco** | Il banco dell'asta, richiama il martelletto |
| **Il Tavolo** | È letteralmente quello che l'app sostituisce |
| **Rilancio** | Il gesto centrale dell'app |
| Il tuo | Se hai già un nome in testa, vince quello |

**Raccomandazione** · **Fantabanco**: identifica il momento dell'asta, è pronunciabile, e non è già
usato da app di fantacalcio note.
**Costo di inversione** · Basso adesso, medio dopo la pubblicazione, perché cambia l'indirizzo web.

---

## D6 · Quante persone e quante leghe

Serve per dimensionare e per capire se il piano gratuito basta.

Domande: quanti partecipanti avrà la tua lega? Prevedi altre leghe con altri gruppi? L'app la userà
qualcuno oltre ai tuoi amici?

**Raccomandazione** · Se restiamo sotto le 50 persone in tutto, il piano gratuito basta con
abbondanza e non c'è niente da decidere.
**Costo di inversione** · Nullo.

---

## D7 · Com'è fatto il tuo facepack

Non è una preferenza, è un'informazione che mi serve: **come sono nominati i file** e **quanti
sono**. Da questo dipende se l'associazione automatica copre il 95% o il 40%, e quindi quanto lavoro
manuale ti resta.

Se puoi, dimmi il nome esatto di tre file di esempio e il numero totale.
**Costo di inversione** · Nullo, è un dato di fatto.

---

## D8 · Il file di esempio per l'esportazione

Per far sì che il CSV finale si carichi davvero nell'app Fantacalcio senza errori, mi serve un file
di esempio del formato di caricamento rose, scaricato dalla tua lega. Senza, produco un CSV generico
e lo dichiaro come non verificato.
**Costo di inversione** · Basso.

---

## D9 · L'asta random ha bisogno di un filtro?

Un'estrazione casuale sull'intero listone produce centinaia di calciatori che nessuno vuole.
Propongo un filtro facoltativo del bacino: solo calciatori sopra una certa quotazione, oppure solo
quelli presenti in almeno una lista obiettivi.

**Raccomandazione** · Aggiungerlo come opzione, spento in modo predefinito.
**Costo di inversione** · Basso.

---

## D10 · Cosa succede se un partecipante va espulso

Se l'amministratore toglie qualcuno dalla lega ad asta iniziata, la sua rosa che fine fa: i
calciatori tornano svincolati, oppure la squadra resta come è, orfana?

**Raccomandazione** · Impedire l'espulsione ad asta aperta. È il caso più semplice e più difendibile.
**Costo di inversione** · Basso.

---

## D11 · Chi carica il listone

Solo tu, una volta per stagione, per tutte le leghe? Oppure ogni amministratore di lega carica il
suo?

**Raccomandazione** · Il listone è unico e globale, lo carichi tu. Un amministratore che carica un
listone sbagliato romperebbe la sua lega senza accorgersene.
**Costo di inversione** · Basso.

---

## D12 · Serve il tema chiaro?

Il tema scuro è predefinito e coerente col logo. Il tema chiaro è lavoro in più e raddoppia le
verifiche di contrasto.

**Raccomandazione** · Rimandarlo. Se all'uso qualcuno lo chiede, si aggiunge.
**Costo di inversione** · Medio se i colori vengono scritti a mano ovunque, **basso** se fin
dall'inizio si usano i nomi dei colori definiti in `docs/04-frontend-e-design.md`. Per questo si
useranno quelli da subito.

---

## Decisioni chiuse

| # | Decisione | Esito | ADR |
|---|---|---|---|
| D1 | Scadenza dell'asta | Oltre 6 settimane, nessuna pressione | — |
| D7 | Ponte fra facepack e listone | Automatico, tramite servizio pubblico di ricerca | `0011-ponte-automatico-tramite-fmref.md` supera `0010` |
| D8 | Formato di esportazione delle rose | Quattro colonne, fornite dall'utente | `0008-formato-esportazione-rose.md` |
| — | Conferma dell'indirizzo email | Disattivata | `0009-conferma-email-disattivata.md` |
| D2 | Backend | Supabase | `0001-backend-supabase.md` |
| D3 | Piattaforma client | Applicazione web installabile | `0002-applicazione-web-installabile.md` |
| D4 | Origine listone e statistiche | Importazione di file | `0003-listone-importazione-manuale.md` |
| D5 | Nome del prodotto | **Fantasta** | `0004-nome-prodotto-fantasta.md` |

Due decisioni tecniche interne sono state prese dagli agenti senza coinvolgere l'utente, perché non
comportano compromessi di prodotto: `0005-timer-autoritativo-del-server.md` e
`0006-dipendenze-iniziali.md`.

## Cosa serve dall'utente per sbloccare le decisioni rimaste

| # | Cosa serve | Blocca |
|---|---|---|
| D6, D9, D10, D11, D12 | Nulla: si procede con la raccomandazione, modificabile in qualsiasi momento a costo quasi nullo | Niente |

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.2 | 2026-09-02 | D7 riaperta e richiusa: il ponte e automatico. Non serve piu niente dall utente. |
| 1.1 | 2026-09-02 | Chiuse D1, D2, D3, D4, D5 con i relativi ADR. |
| 1.0 | 2026-09-02 | Prima raccolta: 12 decisioni aperte. |
