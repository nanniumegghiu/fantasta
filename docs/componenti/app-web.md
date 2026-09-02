# Componente · Applicazione web `app/`

**Scopo** · Descrivere com'è organizzato il codice del client e come si esegue.
**Proprietario** · frontend-engineer
**Stato** · 🟡 Fette 0 e 1 costruite, backend collegato · schermate mai aperte in un browser
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
    ├── lib/
    │   ├── supabase.ts        client del backend
    │   └── messaggioErrore.ts errori tradotti in italiano, in un posto solo
    ├── components/            Bottone, Campo, CampoNumero, Interruttore,
    │                          Intestazione, MarchioFantasta
    ├── features/
    │   ├── auth/              sessione e metodi di accesso
    │   └── leghe/             tipi e chiamate al backend delle leghe
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
| `/invito/:codice` | Lo stesso, ma col codice già scritto. È il link che gira su WhatsApp. |
| `/lega/:id` | Riepilogo: asta, invito, partecipanti, la mia squadra, regole, regolamento. |
| qualsiasi altro | Rimanda a `/leghe`. |

Chi arriva da un link di invito senza aver fatto l'accesso viene mandato ad `/accesso`, e **dopo
l'accesso torna al link di invito**: il codice non si perde per strada. La destinazione è tenuta
nella memoria di sessione del browser.

### Quando il backend non è configurato

Se mancano le variabili d'ambiente, l'app **non mostra il modulo di accesso**: mostra una schermata
che dice cosa manca e come si sistema. È la regola «niente bugie all'utente»: un modulo di accesso
che fallisce sempre con un errore incomprensibile è peggio di un messaggio chiaro.

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

Il file compilato pesa circa 611 kB, 184 kB compressi. È accettabile adesso, non lo sarà quando
arriveranno asta e listone. Prima della Fetta 4 va suddiviso per rotta, così che lo schermo
condiviso non scarichi anche l'importazione del listone.

## Aperto / TODO

- 🔴 Nessuna schermata è mai stata aperta in un browser.
- 🟡 Suddivisione del codice per rotta, prima della Fetta 4.
- 🟡 Il carattere Inter arriva da un servizio esterno. Se durante un'asta la rete è lenta, si vede
  il carattere di sistema. Valutare se portarlo dentro il progetto.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.1 | 2026-09-02 | Fetta 1: schermate delle leghe, inviti, squadre, regolamento in PDF. |
| 1.0 | 2026-09-02 | Fetta 0: struttura, accesso, rotte protette, icone, prima migrazione. |
