# Componente · Applicazione web `app/`

**Scopo** · Descrivere com'è organizzato il codice del client e come si esegue.
**Proprietario** · frontend-engineer
**Stato** · 🟡 Fette da 0 a 4 costruite, backend collegato · schermate provate, tranne l asta in corso
**Data** · 2026-09-02

---

## 1. Cosa fa

È l'applicazione web installabile di Fantasta: la stessa base di codice serve i telefoni dei
partecipanti, il portatile dell'amministratore e lo schermo condiviso.

## 2. Come funziona

### Struttura

```
app/
├── index.html                 pagina d'ingresso, caratteri, icone
├── vite.config.ts             estensioni: React, Tailwind, applicazione installabile
├── scripts/
│   ├── genera-icone.mjs       icone dell'app dal logo, senza dipendenze
│   └── controlla-dipendenze.mjs  confronto con gli ADR 0006 e 0007
├── supabase/migrations/       migrazioni versionate del database
├── public/                    icone generate
└── src/
    ├── main.tsx               punto di partenza
    ├── App.tsx                rotte e protezione degli accessi
    ├── styles/index.css       token del design system
    ├── domain/                regole e formati, senza DOM: girano anche in Node
    │   ├── fogli.ts           lettura di .xlsx e .csv, senza librerie (ADR-0012)
    │   ├── listone.ts         riconoscimento delle colonne e righe scartate
    │   └── stagione.ts        la stagione corrente, in un posto solo
    ├── lib/
    │   ├── supabase.ts        client del backend
    │   └── messaggioErrore.ts errori tradotti in italiano, in un posto solo
    ├── components/            Bottone, Campo, CampoNumero, Interruttore,
    │                          Intestazione, MarchioFantasta
    ├── features/
    │   ├── auth/              sessione e metodi di accesso
    │   ├── leghe/             tipi e chiamate al backend delle leghe
    │   ├── listone/           lettura del listone e importazioni
    │   ├── obiettivi/         la lista obiettivi e i suoi quattro metodi
    │   └── asta/              motore, timer, suoni, impostazioni, conduzione
    └── pages/                 schermate
```

### Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo. Ascolta anche sulla rete locale, così si prova dal telefono. |
| `npm run build` | Controllo dei tipi e compilazione per la pubblicazione. |
| `npm run preview` | Serve il risultato compilato. |
| `npm run icone` | Rigenera le icone da `brand/logo.png`. |
| `npm run controlla-dipendenze` | Verifica che non ci siano pacchetti fuori dagli ADR. |

Tutti si eseguono dentro `app/`.

### Le icone, generate senza librerie

`scripts/genera-icone.mjs` legge il logo, lo riduce con una media dei pixel e lo compone sul verde
notte, scrivendo cinque PNG. Lo fa a mano con `zlib`, che Node ha già, invece di installare una
libreria di immagini: ADR-0006 tiene un elenco chiuso di dipendenze e per cinque file generati una
volta sola non valeva la pena aprirlo.

### Le rotte

| Indirizzo | Cosa mostra |
|---|---|
| `/accesso` | Solo per chi **non** ha una sessione. |
| `/leghe` | Le mie leghe, con le due azioni principali in basso. |
| `/leghe/nuova` | Creazione lega con tutte le regole. |
| `/leghe/entra` | Ingresso con il codice di sei caratteri. |
| `/invito/:codice` | Lo stesso, ma col codice già scritto. È il link che gira su WhatsApp. A chi fa già parte della lega non chiede niente: gli propone di andarci. |
| `/lega/:id` | Riepilogo: asta, listone, invito, partecipanti, la mia squadra, regole, regolamento. |
| `/lega/:id/asta` | La vista personale: rilanci, passo, budget, poteri se sei l amministratore. |
| `/lega/:id/asta/schermo` | Lo schermo condiviso da proiettare. Nessun dato privato. |
| `/lega/:id/obiettivi` | La lista obiettivi: fasce, tetti, note, slot, incroci. Privata. Accetta `?ruolo=P|D|C|A` e apre già filtrata su quel reparto. |
| `/listone` | Tabella dei calciatori: filtri per ruolo e squadra, ordinamento su ogni colonna. |
| `/importazione` | Caricamento di listone e statistiche. Solo amministratori dell applicazione. |
| `/volti` | Revisione dei volti: chi non ce l ha e chi ce l ha dedotto. Solo amministratori dell applicazione. |
| qualsiasi altro | Rimanda a `/leghe`. |

Chi arriva da un link di invito senza aver fatto l'accesso viene mandato ad `/accesso`, e **dopo
l'accesso torna al link di invito**: il codice non si perde per strada. La destinazione è tenuta
nella memoria di sessione del browser.

### Quando il backend non è configurato

Se mancano le variabili d'ambiente, l'app **non mostra il modulo di accesso**: mostra una schermata
che dice cosa manca e come si sistema. È la regola «niente bugie all'utente»: un modulo di accesso
che fallisce sempre con un errore incomprensibile è peggio di un messaggio chiaro.

## 2bis. Come finisce online

L'app sta su **GitHub Pages**, all'indirizzo `https://nanniumegghiu.github.io/fantasta`, e si
ricompila da sola a ogni push sul ramo principale (`.github/workflows/pubblica.yml`).

**Si compila in remoto, non sul computer di casa.** Così quello che è online è sempre quello che sta
nel ramo, e non dipende da cosa aveva installato chi ha premuto il pulsante.

### Il percorso base, che è la cosa che si rompe

Un progetto su GitHub Pages sta sotto il nome del repository: `/fantasta/`. Un percorso base
sbagliato non dà errori, dà una **pagina bianca**: i file ci sono, ma un livello più su. Tre punti
lo devono sapere e li sa tutti da una variabile sola, `VITE_BASE`:

| Dove | Cosa succede senza |
|---|---|
| `base` di Vite | Fogli di stile e pacchetti cercati alla radice: pagina bianca |
| `basename` del router | `/fantasta/leghe` non corrisponde a nessuna rotta |
| `start_url` e `scope` del manifesto | L'app installata parte da un indirizzo che non esiste |

Le immagini scritte con un percorso assoluto nel codice non le riscrive nessuno: le tre che c'erano
adesso usano `import.meta.env.BASE_URL`.

### La ricaduta per le rotte

`/lega/abc/asta` non è un file, e un servizio statico risponde 404. GitHub Pages serve però
`404.html` per ogni indirizzo che non trova: quel file è una copia dell'indice, quindi
l'applicazione parte e il router riconosce l'indirizzo da solo. La copia la fa un'estensione di
Vite e non un passaggio del flusso di pubblicazione, perché una compilazione locale che si comporta
diversamente da quella vera è una trappola.

### Le chiavi

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` stanno nei segreti del repository e finiscono
dentro il pacchetto compilato, che è pubblico. **È il loro mestiere**: sono fatte per stare in ogni
browser che apre l'app, e ciò che protegge i dati sono le regole di accesso del database. Stanno nei
segreti e non nel codice per due motivi pratici: si cambiano senza toccare un file, e chi legge il
repository non le scambia per qualcosa da nascondere.

Il flusso controlla che finiscano davvero nel pacchetto: senza, l'app compilerebbe lo stesso e
mostrerebbe a tutti la schermata «manca la configurazione».

## 3. File coinvolti

Tutti quelli elencati nella struttura qui sopra.

## 4. Decisioni e perché

- **Nomi in italiano nel codice del client.** Il glossario prescrive l'inglese per i nomi del
  dominio, che vivono nel database. Per componenti e variabili locali dell'interfaccia si è scelto
  l'italiano perché il proprietario del progetto non è uno sviluppatore e deve poter leggere il
  codice. I nomi del dominio, quelli che corrispondono a tabelle e colonne, restano in inglese.
- **Nessun aggiornamento ottimistico.** Il `Bottone` ha uno stato di attesa proprio per non dover
  mostrare un risultato non ancora confermato dal server.
- **Le icone si generano, non si disegnano a mano.** Se il logo cambia, un comando rifà tutto.

## Da sapere prima di intervenire

Il codice è **suddiviso per rotta**: chi apre l'asta non scarica l'importazione del listone. Il
blocco comune pesa circa 633 kB, 190 kB compressi, ed è quasi tutto libreria condivisa; le singole
schermate vanno da 3 a 32 kB. La soglia di avviso della compilazione resta superata dal blocco
comune: è un segnale onesto e va tenuto d'occhio, non silenziato.

## Aperto / TODO

- 🔴 Nessuna schermata è mai stata aperta in un browser.
- ✅ Suddivisione del codice per rotta: fatta.
- 🟡 Il blocco comune resta sopra la soglia di avviso: quasi tutto libreria condivisa.
- 🟡 Il carattere Inter arriva da un servizio esterno. Se durante un'asta la rete è lenta, si vede
  il carattere di sistema. Valutare se portarlo dentro il progetto.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.15 | 2026-09-04 | Stemmi delle squadre, firmati a blocchi come i volti. |
| 1.14 | 2026-09-04 | Schermata di revisione dei volti, raggiungibile dal listone. |
| 1.13 | 2026-09-04 | Pubblicata online su GitHub Pages: percorso base, ricaduta per le rotte, compilazione automatica. |
| 1.12 | 2026-09-04 | Esportazione delle rose e scambi fra squadre nella schermata della lega. |
| 1.11 | 2026-09-04 | Volti dei calciatori ovunque, con ricaduta sulle iniziali. Il listone mostra una stagione sola. |
| 1.10 | 2026-09-03 | Correzione delle rose nel pannello di conduzione, registro dell asta visibile a tutti. |
| 1.9 | 2026-09-03 | La freccia indietro usa la cronologia. Rose nella vista personale. Obiettivi vivi. |
| 1.8 | 2026-09-03 | Schermo condiviso con le rose complete. Conduzione a scomparsa. Riempimento per nome e chiusura a mano dell asta. |
| 1.7 | 2026-09-03 | Colonna del ruolo nel listone. Slot fissati dal regolamento, con un massimale per posto. Schermate provate tranne l asta in corso. |
| 1.6 | 2026-09-03 | Obiettivi divisi per reparto con il filtro in cima; il reparto sta nell indirizzo, e l asta ci porta su quello in corso. |
| 1.5 | 2026-09-03 | Corretti due difetti segnalati all uso: il campo password si riempiva da solo e mancava la conferma in registrazione. |
| 1.4 | 2026-09-03 | Fetta 4: vista personale dell asta, schermo condiviso, impostazioni pre-asta e pannello di conduzione. |
| 1.3 | 2026-09-02 | Fetta 3: schermata della lista obiettivi e selettore dei calciatori. |
| 1.2 | 2026-09-02 | Fetta 2: lettore di fogli di calcolo, importazione, tabella del listone. Codice suddiviso per rotta. |
| 1.1 | 2026-09-02 | Fetta 1: schermate delle leghe, inviti, squadre, regolamento in PDF. |
| 1.0 | 2026-09-02 | Fetta 0: struttura, accesso, rotte protette, icone, prima migrazione. |
