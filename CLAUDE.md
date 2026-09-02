# CLAUDE.md — Manuale madre del progetto

> **Questo è il file che si legge per primo in ogni sessione, sempre, prima di qualunque altra cosa.**
> Se hai fretta, leggi almeno: *Cos'è il prodotto*, *Regole non negoziabili*, *Stato attuale*.

**Versione documento** · 1.6 · **Data** · 2026-09-03

---

## 1. Cos'è il prodotto

**Fantasta** è un'applicazione per fare **l'asta del fantacalcio Classic fra amici**, dalla
preparazione fino alle rose finite.

Un gruppo di amici crea una lega, ognuno entra con un codice di invito ricevuto su WhatsApp e si dà
un nome di squadra. Prima dell'asta ciascuno prepara in privato la propria **lista obiettivi**, con
il metodo che preferisce: fasce di valore, tetti di spesa, slot della rosa ideale, incroci fra
portieri. La sera dell'asta l'app diventa tre cose insieme: un **tabellone** proiettato sul
televisore che mostra a tutti chi è in asta, a quanto e con quali statistiche, e che emette i suoni
della serata; il **telefono di ciascuno**, da cui si rilancia e si tiene d'occhio la propria
strategia; e la **plancia dell'amministratore**, che conduce. Quando tutte le rose sono complete, si
esporta il file da caricare nell'app Fantacalcio.

**Cosa il prodotto non fa**, dichiarato per evitare che ci finisca dentro di nascosto: formazioni
settimanali, punteggi di giornata, classifiche, mercato di riparazione, chat, pagine legali.

Il nome si scrive **Fantasta** nei testi e `fantasta` nel codice. Vedi ADR-0004.

---

## 2. Indice della documentazione

| Documento | Di cosa parla | Proprietario |
|---|---|---|
| `docs/00-glossario.md` | Come si chiamano le cose, in italiano e nel codice | project-manager |
| `docs/01-architettura.md` | I pezzi del sistema e chi decide cosa | project-manager |
| `docs/02-dominio-fantacalcio.md` | **Le regole del gioco**: rose, crediti, metodi d'asta, timer | backend-engineer |
| `docs/03-modello-dati.md` | Tabelle, campi, relazioni, viste | backend-engineer |
| `docs/04-frontend-e-design.md` | Palette dal logo, tipografia, animazioni, suoni, schermate | frontend-engineer |
| `docs/05-asta-realtime.md` | Sincronia, timer del server, offerte simultanee, riconnessioni | backend-engineer |
| `docs/06-sicurezza-e-accessi.md` | Chi legge cosa, accesso, inviti, credenziali | security-officer |
| `docs/07-dati-calciatori-facepack-export.md` | Listone, statistiche, foto, esportazione CSV | backend-engineer |
| `docs/08-roadmap.md` | In che ordine si costruisce, e come si dimostra ogni fetta | project-manager |
| `docs/09-decisioni-aperte.md` | **Le scelte ancora da fare**, con pro, contro e raccomandazioni | project-manager |
| `docs/adr/` | Le decisioni prese, una per file, immutabili | project-manager |
| `docs/componenti/app-web.md` | Struttura del codice del client, rotte e comandi | frontend-engineer |
| `docs/qa/` | Rapporti del protocollo di test iper-critico | qa-lead |
| `docs/decisioni/` | Registro dei brainstorming, per non riaprire discussioni chiuse | doc-supervisor |

I due metodi di lavoro che governano il progetto sono in cartella e vanno rispettati:
`Metodo-Progetti-Professionali.md` per come si costruisce,
`Metodo-QA-Testing-Iper-Critico.md` per come si verifica.

---

## 3. Struttura delle cartelle

```
Progetto Fantacalcio/
├── CLAUDE.md                    ← questo file
├── .gitignore                   ← curato dal security-officer
├── .env.example                 ← quali credenziali servono e dove stanno
├── .claude/
│   ├── agents/                  ← i cinque agenti più il QA
│   └── skills/                  ← procedure riutilizzabili
├── brand/                       ← il logo, fonte dei colori dell'app
├── docs/                        ← un documento per area
└── app/                         ← il codice. Vedi docs/componenti/app-web.md
    ├── src/                     ← interfaccia, accesso, rotte
    ├── scripts/                 ← icone e controllo delle dipendenze
    ├── supabase/migrations/     ← migrazioni versionate del database
    └── public/                  ← icone generate dal logo
```

**Scelte non ovvie:**

- `brand/` esiste perché la palette dell'app è **estratta dai pixel del logo**, non inventata. Il
  logo è la fonte, non una decorazione.
- Il facepack e i file del listone **non stanno nel repository**: sono centinaia di file binari e
  fogli di calcolo che non hanno niente da fare in un sistema di versionamento. Vanno nell'archivio
  file del backend. Per questo `facepack/`, `*.xlsx` e `*.csv` sono ignorati.
- `app/` è nato **dopo** le decisioni sullo stack, non prima: è la regola del metodo.
- Gli `scripts/` alla radice sono automazioni che parlano col backend con le credenziali di
  sviluppo. Quelli dentro `app/scripts/` riguardano solo la compilazione del client.

---

## 4. Gli agenti e le loro autorità

| Agente | Ruolo | Autorità |
|---|---|---|
| **project-manager** | Pianifica, arbitra, scrive gli ADR | Decide le priorità. Non scrive codice di prodotto |
| **doc-supervisor** | Tiene la documentazione allineata al codice | **Può bloccare una consegna** se la doc è indietro |
| **backend-engineer** | Dati, migrazioni, contratti, motore d'asta | **Proprietario dei dati e dei contratti** |
| **frontend-engineer** | Interfaccia, design system, accessibilità | **Proprietario del lato client** |
| **security-officer** | Accessi, permessi, segreti. Revisiona gli altri due | **Potere di veto** sulle consegne insicure |
| **qa-lead** | Protocollo di test iper-critico | Nessuna modifica al codice: osserva e riferisce |

Il protocollo fra frontend e backend è in `.claude/skills/contratto-dati/SKILL.md`.

---

## 5. Le dieci regole non negoziabili

1. **Il server è l'unica autorità** su crediti, offerte, tempo e aggiudicazioni. Il client propone,
   il server decide.
2. **Ogni tabella nasce con le sue regole di accesso**, nella stessa migrazione. Default: negato.
3. **La lista obiettivi è privata**, anche dall'amministratore di lega. Nelle policy del database,
   non solo nell'interfaccia.
4. **Verificare, non dichiarare.** «Fatto» si dice solo dopo aver guardato l'output, e l'output si
   mostra. Una build verde non è una prova.
5. **Niente bugie all'interfaccia.** Ciò che non è disponibile lo dice. Mai una conferma per
   qualcosa che non è successo.
6. **Ciò che è progettato ma non costruito si marca 🔴 o 🟡.** Descrivere come esistente ciò che non
   esiste è l'errore più grave del progetto.
7. **Un fatto in un posto solo.** Se un'informazione sta in due documenti, uno la contiene e l'altro
   la collega.
8. **Migrazioni versionate**, mai modifiche manuali allo schema. Una correzione è una nuova
   migrazione.
9. **Mobile-first**: si progetta a 360 px e si sale. Nessuna dipendenza senza motivo scritto.
10. **Fette verticali**: ogni fase finisce in qualcosa che si può mostrare e usare.

---

## 6. Stack tecnico e ambiente

**Ambiente verificato sulla macchina il 2 settembre 2026**, con i comandi eseguiti davvero:

| Strumento | Versione | Esito |
|---|---|---|
| Node.js | 22.14.0 | ✅ presente |
| npm | 11.3.0 | ✅ presente |
| Git | 2.54.0 windows | ✅ presente |
| GitHub CLI | 2.97.0 | ✅ presente |
| Python | — | ❌ assente, non necessario |

Sistema: Windows 11, shell PowerShell.

**Stack applicativo**, deciso il 2 settembre 2026:

| Strato | Scelta | ADR |
|---|---|---|
| Backend, dati, accesso, realtime, archivio file | **Supabase** su PostgreSQL | `0001` |
| Client | **Applicazione web installabile**, React con Vite e TypeScript | `0002` |
| Dati dei calciatori | **Importazione di file**, non raccolta automatica | `0003` |
| Countdown d'asta | Istanti salvati dal server, non contatori locali | `0005` |
| Dipendenze autorizzate | Elenco chiuso, una per una con il motivo | `0006`, `0007` |
| Esportazione delle rose | Quattro colonne fissate dalle istruzioni ufficiali | `0008` |
| Conferma dell'indirizzo email | Disattivata: il servizio incluso manda 2 email all'ora | `0009` |
| Foto del facepack | Ponte automatico verso gli identificativi di Football Manager | `0011` supera `0010` |
| Lettura di .xlsx e .csv | Scritta nel progetto, senza librerie | `0012` |

Nessun pacchetto che non compaia in ADR-0006 è autorizzato. Se un comando ne installa uno, o si
toglie o si scrive un ADR che supera il precedente.

---

## 7. Stato attuale e prossimo passo

**Stato** · Prima sessione conclusa. Struttura, documentazione, decisioni e **Fetta 0 costruita**.
L'applicazione compila e si avvia, ma **non è ancora collegata al backend**: mancano le due chiavi.

| Area | Stato |
|---|---|
| Struttura cartelle e repository Git | ✅ fatto e verificato |
| Documentazione di area, 10 documenti | ✅ scritta |
| Agenti, 6 · Skill, 5 | ✅ scritti |
| Palette estratta dal logo | ✅ fatto, valori reali dai pixel |
| Decisioni | ✅ 5 chiuse con ADR, 7 aperte non bloccanti |
| ADR | ✅ 7 scritti |
| Applicazione: struttura, compilazione, icone | ✅ fatto, compilazione verificata |
| Backend Supabase creato e attivo | ✅ progetto `fantasta`, migrazione applicata |
| Regole di accesso provate violandole | ✅ 7 prove su 7, `node scripts/verifica-sicurezza.mjs` |
| Registrazione e accesso con email | ✅ verificati con richieste reali |
| Fetta 1: leghe, inviti, squadre, regolamento in PDF | ✅ 30 prove su 30 lato server |
| Fetta 2: importazione listone e statistiche, tabella | ✅ 17 prove su 17 lato server |
| Fetta 3: lista obiettivi con i quattro metodi | ✅ 24 prove su 24 lato server |
| Fetta 4: asta completa, sette varianti, passo, poteri admin | ✅ 57 prove su 57 lato server |
| Schermo condiviso con i suoni | 🟡 scritto, mai aperto in un browser |
| Tutte le schermate | 🟡 scritte e compilate, **mai aperte in un browser** |
| Accesso con Google | 🔴 provider non configurato, servono le chiavi Google |
| Fette 5, 6, 7: facepack, esportazione, scambi | 🔴 non iniziate |

**Prossimo passo** · Aprire l'app in un browser e provare il giro completo su due dispositivi:
creo la lega, mando il codice, il secondo entra, apro il listone, preparo gli obiettivi e faccio
un'asta di prova con lo schermo condiviso acceso. Poi la Fetta 5, il facepack, e la Fetta 6,
l'esportazione delle rose.

---

## 7bis. Le automazioni pronte

> ⚠️ **Gli script di verifica girano sul database vero.** Il ramo `--pulisci` cancella dati. I
> calciatori di prova hanno identificativi da **900000 in su** e la pulizia tocca solo quelli: il
> listone caricato dall'utente non si tocca. Se scrivi una prova nuova che crea calciatori, usa
> quell'intervallo. È già successo di cancellare il listone vero: vedi
> `docs/decisioni/2026-09-03-il-listone-cancellato-dalle-prove.md`.

Tutte si lanciano dalla cartella del progetto, non da `app/`.

| Comando | Cosa fa |
|---|---|
| `node scripts/prepara-backend.mjs` | Crea il progetto Supabase se manca, scrive le chiavi in `app/.env.local` e applica le migrazioni non ancora applicate. Ripetibile senza danni. |
| `node scripts/verifica-sicurezza.mjs` | Sette prove sui profili: prova a leggere e scrivere dati altrui e verifica di essere respinto. |
| `node scripts/verifica-leghe.mjs` | Trenta prove su leghe, inviti, squadre e regolamento. Con `--pulisci` rimuove gli utenti di prova. |
| `node --experimental-strip-types scripts/verifica-listone.mjs` | Diciassette prove sulla lettura dei file e sull importazione del listone. Costruisce da zero un vero `.xlsx` per provarci sopra. |
| `node scripts/verifica-obiettivi.mjs` | Ventiquattro prove sulla lista obiettivi. Le sette che contano di più provano a leggere la lista di un altro, amministratore compreso. |
| `node scripts/verifica-asta.mjs` | Ventisei prove sul motore d asta: massimo offribile, offerte simultanee, offerta arrivata dopo la campanella, chiusura automatica quando le rose sono complete. |
| `node scripts/verifica-asta-completa.mjs` | Trentuno prove sulle sette varianti, la modalità live, la chiamata con passo, i poteri dell amministratore e la rete di sicurezza. |
| `node scripts/verifica-eliminazione-lega.mjs` | Undici prove sull eliminazione di una lega: chi può, la conferma del nome, e che non resti niente in giro. |

---

## 8. Come iniziare una nuova sessione

1. Leggi questo file per intero.
2. Leggi `docs/09-decisioni-aperte.md`: se c'è una decisione aperta che blocca il lavoro di oggi,
   portala all'utente **prima** di scrivere codice.
3. Leggi il documento di area della cosa che stai per toccare, e la skill collegata.
4. Lavora. Alla fine esegui la checklist di `.claude/skills/allineamento-doc/SKILL.md`.
5. Chiudi dicendo: cosa hai fatto, **cosa hai verificato con le prove**, cosa manca, cosa serve
   dall'utente.

**Come parlare all'utente**: in italiano, diretto, senza giri di parole. Non è uno sviluppatore:
ogni passaggio manuale che gli affidi è costoso e a rischio. Cerca sempre prima la via
automatizzabile. Portagli le decisioni, non i dettagli tecnici. Quando qualcosa non funziona,
mostragli l'errore vero.

---

## 9. Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.6 | 2026-09-03 | Fetta 4 completata: sette varianti, modalità live, chiamata con passo, poteri dell amministratore, rete di sicurezza pianificata. |
| 1.5 | 2026-09-02 | Fetta 4a e 4b costruite: motore d asta con timer del server, schermo condiviso con riepilogo totale e suoni sintetizzati. Due difese che bloccavano il server stesso corrette. |
| 1.4 | 2026-09-02 | Fetta 3 costruita: lista obiettivi con i quattro metodi, invisibile a chiunque altro. |
| 1.3 | 2026-09-02 | Fetta 2 costruita: lettore di fogli di calcolo senza dipendenze (ADR-0012), importazione con anteprima, tabella del listone. |
| 1.2 | 2026-09-02 | Backend collegato e verificato. Fetta 1 costruita: leghe, inviti, squadre, regolamento in PDF, con 30 prove superate. ADR 0008-0011. |
| 1.1 | 2026-09-02 | Chiuse 5 decisioni con 7 ADR. Nome del prodotto: Fantasta. Fetta 0 costruita: applicazione web installabile che compila, icone generate dal logo, accesso e rotte protette, prima migrazione con le sue policy. |
| 1.0 | 2026-09-02 | Prima sessione: struttura, 10 documenti di area, 6 agenti, 5 skill, palette dal logo, 12 decisioni aperte. Nessun codice, come previsto dal metodo. |
