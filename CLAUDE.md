# CLAUDE.md — Manuale madre del progetto

> **Questo è il file che si legge per primo in ogni sessione, sempre, prima di qualunque altra cosa.**
> Se hai fretta, leggi almeno: *Cos'è il prodotto*, *Regole non negoziabili*, *Stato attuale*.

**Versione documento** · 1.0 · **Data** · 2026-09-02

---

## 1. Cos'è il prodotto

Un'applicazione per fare **l'asta del fantacalcio Classic fra amici**, dalla preparazione fino alle
rose finite.

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

Il nome dell'app non è ancora deciso: vedi la decisione D5 in `docs/09-decisioni-aperte.md`.

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
| `docs/componenti/` | Dettaglio dei singoli moduli di codice | chi lo scrive |
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
└── app/                         ← il codice 🔴 non ancora creato
```

**Scelte non ovvie:**

- `brand/` esiste perché la palette dell'app è **estratta dai pixel del logo**, non inventata. Il
  logo è la fonte, non una decorazione.
- Il facepack e i file del listone **non stanno nel repository**: sono centinaia di file binari e
  fogli di calcolo che non hanno niente da fare in un sistema di versionamento. Vanno nell'archivio
  file del backend. Per questo `facepack/`, `*.xlsx` e `*.csv` sono ignorati.
- `app/` non esiste ancora **di proposito**: si crea dopo le decisioni sullo stack, non prima.

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

**Stack applicativo** · 🔴 **non ancora scelto.** Le opzioni, con pro e contro reali, sono in
`docs/09-decisioni-aperte.md`, decisioni D2 e D3. Nulla è stato installato e nessuna dipendenza è
stata aggiunta: il metodo lo vieta prima della decisione.

---

## 7. Stato attuale e prossimo passo

**Stato** · Prima sessione. Esistono struttura, documentazione, agenti e skill. **Non esiste una
riga di codice di prodotto**, ed è voluto.

| Area | Stato |
|---|---|
| Struttura cartelle e repository Git | ✅ fatto e verificato |
| Documentazione di area, 10 documenti | ✅ scritta |
| Agenti, 6 | ✅ scritti |
| Skill, 5 | ✅ scritte |
| Palette estratta dal logo | ✅ fatto, valori reali dai pixel |
| Decisioni aperte raccolte | ✅ 12 decisioni, 0 chiuse |
| ADR | 🔴 nessuno: dipendono dalle decisioni |
| Codice dell'applicazione | 🔴 non iniziato |

**Prossimo passo** · Chiudere le decisioni D1, D2, D3 e D4 di `docs/09-decisioni-aperte.md`,
scrivere gli ADR corrispondenti, poi iniziare la Fetta 0 della roadmap.

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
| 1.0 | 2026-09-02 | Prima sessione: struttura, 10 documenti di area, 6 agenti, 5 skill, palette dal logo, 12 decisioni aperte. Nessun codice, come previsto dal metodo. |
