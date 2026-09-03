# 03 · Modello dei dati

**Scopo** · Elencare tutte le entità del sistema, i loro campi e le relazioni. È il contratto che
frontend e backend concordano **prima** di scrivere interfaccia.
**Proprietario** · backend-engineer
**Stato** · 🟡 create e verificate tutte le tabelle tranne quelle degli scambi
**Data** · 2026-09-02

---

## 1. Cosa fa

Definisce dove vive ogni informazione. Nomi delle tabelle e delle colonne in inglese, come da
`docs/00-glossario.md`. Ogni tabella nasce **insieme alle sue regole di accesso**, nella stessa
migrazione: mai una tabella senza permessi, nemmeno per un commit.

## 2. Come funziona

### 2.1 Mappa delle relazioni

```
utente ──< partecipazione >── lega ──── asta ──< lotto ──< offerta
   │                            │                  │
   │                            ├──< squadra ──< acquisto >── calciatore
   │                            │                                  │
   └──────< lista obiettivi ────┘                                  │
                │                                                  │
                ├──< fascia                                        │
                ├──< obiettivo >───────────────────────────────────┤
                ├──< slot rosa ideale ──< candidato >──────────────┤
                └──< incrocio portieri ──< membro >────────────────┘
```

### 2.2 Anagrafica e leghe

**`profiles`** — l'utente. L'identità di accesso è gestita dal servizio di autenticazione; qui
teniamo solo ciò che serve mostrare.

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | Coincide con l'identità di autenticazione |
| `display_name` | text | Nome mostrato agli altri |
| `avatar_url` | text | Facoltativo |
| `created_at` | timestamptz | |

**`leagues`** — la lega.

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `name` | text | |
| `season` | text | Es. `2026/27` |
| `admin_user_id` | uuid | Il creatore |
| `invite_code` | text unico | 6 caratteri leggibili, senza O/0/I/1 |
| `invite_active` | bool | L'amministratore può disattivarlo o rigenerarlo |
| `rules_pdf_path` | text | Il PDF del regolamento nell'archivio file |
| `credits_initial` | int | Predefinito 500 |
| `slots_p`, `slots_d`, `slots_c`, `slots_a` | int | Predefiniti 3, 8, 8, 6 |
| `min_bid` | int | Predefinito 1 |
| `trades_enabled` | bool | |
| `trades_with_credits_enabled` | bool | |
| `status` | enum | `setup`, `auction`, `done` |

> Le impostazioni stanno **come colonne**, non dentro un campo unico in formato libero. Un campo
> libero non può essere validato dal database e diventa il posto dove finiscono gli errori di
> battitura.

**`league_members`** — chi sta in quale lega. Chiave `(league_id, user_id)`.

| Campo | Tipo | Note |
|---|---|---|
| `league_id`, `user_id` | uuid | |
| `role` | enum | `admin` o `member` |
| `joined_at` | timestamptz | |

**`teams`** — la squadra fantacalcistica, una per partecipante per lega.

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `league_id`, `user_id` | uuid | Unico insieme |
| `name` | text | Scelto dal partecipante |
| `credits_remaining` | int | Aggiornato solo dal server |

### 2.3 Calciatori e statistiche

**`players`** — globale, non per lega: lo stesso calciatore serve a tutte le leghe.

| Campo | Tipo | Note |
|---|---|---|
| `id` | int | L'identificativo del listone ufficiale, se disponibile |
| `name` | text | |
| `role` | enum | `P`, `D`, `C`, `A` |
| `serie_a_team` | text | Il club reale |
| `quotation` | int | Prezzo di partenza |
| `photo_path` | text | Foto del facepack, se associata |
| `season` | text | |

**`player_stats`** — una riga per calciatore per stagione, sovrascritta a ogni aggiornamento.

| Campo | Tipo |
|---|---|
| `player_id`, `season` | |
| `matchday` | int, l'ultima giornata completa inclusa |
| `games_played`, `minutes` | int |
| `avg_vote`, `fanta_avg` | numeric |
| `goals`, `assists` | int |
| `yellow_cards`, `red_cards` | int |
| `updated_at` | timestamptz |

### 2.4 Asta

**`auctions`** — una per lega.

| Campo | Tipo | Note |
|---|---|---|
| `id`, `league_id` | uuid | |
| `status` | enum | `draft`, `open`, `paused`, `closed` |
| `method` | enum | `chiamata`, `alfabetico`, `random` |
| `variant` | enum | `per_ruolo`, `totale`, `ibrida` |
| `conduction` | enum | `app`, `live` |
| `bid_type` | enum | `libera`, `con_passo` |
| `inactivity_seconds` | int | Predefinito 8 |
| `countdown_seconds` | int | Predefinito 5 |
| `nomination_order` | uuid[] | Le squadre nell'ordine di chiamata |
| `current_turn_index` | int | Chi tocca adesso |
| `current_role_phase` | enum | Il reparto aperto, solo nelle varianti per ruolo |
| `random_pool_filter` | jsonb | Restrizioni del bacino, solo nel metodo random |
| `opened_at`, `closed_at` | timestamptz | |

**`auction_lots`** — il singolo calciatore all'asta.

| Campo | Tipo | Note |
|---|---|---|
| `id`, `auction_id`, `player_id` | | |
| `status` | enum | `open`, `awarded`, `passed`, `cancelled` |
| `nominated_by_team_id` | uuid | Nullo nell'alfabetica e nella random |
| `current_bid` | int | |
| `current_bidder_team_id` | uuid | |
| `last_bid_at` | timestamptz | **L unico istante salvato**: attesa, countdown e scadenza si ricavano tutti da qui. Vedi `docs/05-asta-realtime.md` |
| `awarded_team_id`, `final_price` | | Alla chiusura |

**`bids`** — a sola aggiunta.

| Campo | Tipo |
|---|---|
| `id`, `lot_id`, `team_id` | |
| `amount` | int |
| `created_at` | timestamptz |

**`lot_passes`** — chi ha passato su quale lotto, solo in modalità con passo.

**`auction_events`** — il registro immutabile.

| Campo | Tipo | Note |
|---|---|---|
| `id`, `auction_id` | | |
| `type` | text | `nomination`, `bid`, `pass`, `award`, `quick_assign`, `skip`, `undo`, `pause` |
| `payload` | jsonb | I dettagli dell'evento |
| `actor_user_id` | uuid | |
| `created_at` | timestamptz | |

**`roster_players`** — chi ha comprato chi.

| Campo | Tipo | Note |
|---|---|---|
| `id`, `team_id`, `player_id` | | Un calciatore una volta sola per lega |
| `price` | int | |
| `source` | enum | `auction`, `quick_assign`, `trade` |
| `acquired_at` | timestamptz | |

### 2.5 Lista obiettivi

Tutte queste tabelle sono **private del proprietario**. Nessun'altra persona della lega, compreso
l'amministratore, può leggerle.

**`target_lists`** — una per utente per lega.

| Campo | Cosa dice |
|---|---|
| `metodo` | `fasce` oppure `slot`. **Uno solo**: rispondono alla stessa domanda in due modi alternativi |
| `metodo_confermato` | Finché è falso, la schermata apre sulla scelta del metodo |
| `usa_tetti` | Il tetto di spesa, aggiunta accendibile in tutti e due i metodi |
| `usa_incroci` | L'incrocio portieri, indipendente dal metodo |

> Perché una scelta e non quattro interruttori: vedi
> `docs/decisioni/2026-09-03-fasce-e-slot-sono-alternativi.md`. La nota su ogni obiettivo non è
> un'opzione, c'è sempre: è quella che ricompare sul telefono quando quel nome viene chiamato.

**`tiers`** — le fasce: `id`, `list_id`, `role`, `name`, `color`, `position`.

Una fascia **appartiene a un reparto**, come già facevano gli slot. Il ruolo non è un modo di
visualizzare, è la prima divisione della preparazione: durante l'asta si chiamano i portieri, e in
quel momento gli altri tre reparti sono rumore da nascondere. Conseguenza pratica: una fascia di
difensori non accoglie attaccanti, e quando scegli i nomi non ti vengono nemmeno proposti. Il nome
può ripetersi fra reparti diversi, l'unicità è su `(list_id, role, name)`.

Alla creazione della lista nascono tre fasce per ognuno dei quattro reparti, dodici in tutto.

**`targets`** — il singolo obiettivo.

| Campo | Tipo | Note |
|---|---|---|
| `id`, `list_id`, `player_id` | | |
| `tier_id` | uuid | Facoltativo, metodo delle fasce. La fascia deve essere del reparto del calciatore: `aggiungi_a_fascia` e `riordina_obiettivi` rifiutano il resto |
| `max_price` | int | Facoltativo, metodo del budget massimo |
| `priority` | int | Ordine dentro la fascia |
| `note` | text | Testo libero, mostrato durante l'asta |
| `status` | enum | `open`, `taken`, `won`, `dropped`, aggiornato dagli eventi d'asta |

**`roster_slots`** e **`slot_candidates`** — la strategia degli slot.

Uno slot è **un posto della rosa**, e i posti li decide il regolamento della lega: la quantità per
ruolo viene da `leagues.slots_p/d/c/a` e non si sceglie. `sincronizza_slot` li allinea a ogni
apertura della lista, creando quelli che mancano e togliendo quelli che avanzano; quando ne avanzano,
va via il meno pieno, a parità l'ultimo della fila, perché si perda il minimo lavoro possibile.

| Campo | Note |
|---|---|
| `role` | Dal regolamento. Non modificabile dal client |
| `position` | Contigua dentro il reparto, rinumerata dalla sincronizzazione |
| `label` | **Modificabile**: «Attaccante 1» diventa «il bomber» |
| `max_price` | **Modificabile**: quanto sei disposto a spendere per riempire questo posto, con chiunque dei suoi candidati |

Il massimale sta sullo slot e non sul calciatore perché la domanda a cui gli slot rispondono non è
«quanto vale questo nome» ma «quanto spendo per questo posto». Il tetto per calciatore
(`targets.max_price`) resta dov'era: serve al metodo delle fasce. Vedi
`docs/decisioni/2026-09-03-lo-slot-e-un-posto-non-una-casella.md`.

La regola è difesa dai permessi, non solo dalla schermata: sulla tabella l'utente ha `select` e
`update` di due sole colonne, `label` e `max_price`. Creare o cancellare uno slot dal client
risponde 403.

`slot_candidates` tiene i candidati in ordine di preferenza. `togli_da_slot` stacca il candidato
e, se non è rimasto in nessun altro posto, toglie anche l'obiettivo: con questo metodo un obiettivo
esiste perché è candidato a un posto.

**`goalkeeper_pairings`** e **`pairing_members`** — l'incrocio portieri: un gruppo di due o tre
portieri con una nota sull'alternanza dei calendari.

### 2.6 Viste

| Vista | A cosa serve |
|---|---|
| `available_players` | Il listone svincolati: calciatori meno quelli già acquistati in quella lega. Con statistiche già unite, così la tabella si ordina e si filtra senza query aggiuntive. |
| `team_budget` | Per ogni squadra: crediti residui, slot mancanti per ruolo, **massimo offribile**. È il numero che lo schermo condiviso mostra accanto a ogni nome. |
| `target_progress` | Per la lista di un utente: quanti obiettivi restano liberi, quanti presi da altri, quanti vinti. |

## 3. File coinvolti

Migrazioni applicate, in `app/supabase/migrations/`:

| File | Cosa crea |
|---|---|
| `20260902120000_profili.sql` | `profiles`, trigger di creazione, policy |
| `20260902140000_leghe.sql` | `leagues`, `league_members`, `teams`, `invite_attempts`, funzioni di appartenenza, archivio del regolamento |
| `20260902160000_ingresso_lega_con_esito.sql` | `entra_in_lega` che restituisce un esito invece di sollevare eccezioni |
| `20260902180000_listone.sql` | `players`, `player_stats`, `app_admins`, funzioni di importazione, vista `listone` |
| `20260902200000_obiettivi.sql` | `target_lists`, `tiers`, `targets`, `roster_slots`, `slot_candidates`, `goalkeeper_pairings`, `pairing_members` |
| `20260902220000_asta.sql` | `auctions`, `auction_lots`, `bids`, `lot_passes`, `roster_players`, `auction_events`, vista `team_budget`, motore d asta |
| `20260902230000_crediti_riconosci_il_server.sql` | Correzione: la difesa sui crediti bloccava il server stesso |
| `20260902233000_registro_cancellazione_a_cascata.sql` | Correzione: il registro immutabile impediva di cancellare una lega |
| `20260903000000_asta_completa.sql` | Le sette varianti, la modalità live, la chiamata con passo, i poteri dell amministratore |
| `20260903010000_rete_di_sicurezza_pianificata.sql` | Il compito che ogni dieci secondi chiude i lotti scaduti dimenticati |
| `20260903120000_invito_dice_se_sei_gia_dentro.sql` | L anteprima dell invito dice se chi guarda fa già parte della lega |
| `20260903100000_lista_obiettivi_un_metodo_solo.sql` | `metodo` al posto dei due interruttori, riordino, aggiunte dirette a slot e incroci |
| `20260903020000_elimina_lega.sql` | `elimina_lega`: cancellazione a cascata, con il nome della lega da riscrivere |
| `20260903140000_fasce_per_ruolo.sql` | `tiers.role` obbligatorio, fasce di partenza per reparto, `aggiungi_a_fascia`, riordino che non mescola i reparti |
| `20260903150000_asta_rispetta_la_stagione.sql` | L asta pesca solo dal listone della stagione della lega |
| `20260903170000_slot_come_il_regolamento.sql` | `roster_slots.max_price`, `sincronizza_slot`, `togli_da_slot`, permessi ridotti a `label` e `max_price` |

La forma dei dati vista dal client è in `app/src/features/leghe/tipi.ts`.

> **Nota sulle funzioni del database.** Un esito previsto si **restituisce**, non si solleva come
> eccezione: in PostgreSQL l'eccezione annulla l'intera transazione, comprese le scritture che
> servivano. Il caso concreto che ce l'ha insegnato è in `docs/decisioni/2026-09-02-eccezioni-e-transazioni.md`.

## 4. Decisioni e perché

- **I calciatori sono globali, gli acquisti sono per lega.** Duplicare il listone per ogni lega
  significherebbe caricare il facepack e le statistiche N volte.
- **`last_bid_at` sul lotto invece di un contatore.** Salvare l'istante permette a chi si riconnette
  di calcolare da solo quanti secondi mancano, senza chiedere niente a nessuno.
- **Le impostazioni della lega sono colonne tipizzate.** Vedi il riquadro al punto 2.2.
- **Il registro eventi è separato dallo stato corrente.** Lo stato dice com'è adesso, il registro
  dice come ci si è arrivati. Servono a cose diverse.

## Da sapere prima di intervenire

`credits_remaining` e `roster_players` devono cambiare **nella stessa transazione**
dell'aggiudicazione. Se si separano, un errore a metà lascia una squadra con il calciatore ma senza
lo scalo dei crediti, e l'asta diventa incontestabile solo a parole.

## Aperto / TODO

- 🟡 I campi esatti delle statistiche dipendono dal file reale del listone, ancora da vedere.
- 🔴 Tabelle degli scambi: non progettate, previste dopo l'asta.

## Changelog

| Versione | Data | Cosa cambia |
|---|---|---|
| 1.5 | 2026-09-03 | La lista obiettivi ha un metodo solo. Funzioni di riordino e di aggiunta diretta. |
| 1.4 | 2026-09-03 | Tabelle dell asta, correzioni ai trigger, eliminazione della lega. |
| 1.3 | 2026-09-02 | Fetta 3: lista obiettivi con i quattro metodi. Slot e incroci puntano agli obiettivi, non ai calciatori. |
| 1.2 | 2026-09-02 | Fetta 2: listone e statistiche esistono davvero, con le funzioni di importazione e la vista che li unisce. Aggiunto il concetto di amministratore dell applicazione. |
| 1.1 | 2026-09-02 | Fetta 1 realizzata: leagues, league_members, teams e invite_attempts esistono davvero. Aggiunte le funzioni di ingresso. |
| 1.0 | 2026-09-02 | Prima stesura completa, indipendente dal database concreto. |
