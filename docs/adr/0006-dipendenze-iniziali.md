# ADR-0006 · Le dipendenze iniziali, una per una, con il motivo

**Stato** · Accettato · **Data** · 2026-09-02 · **Decide** · frontend-engineer e backend-engineer

---

## Contesto

Il metodo adottato vieta le dipendenze senza motivo scritto, comprese quelle che un generatore di
progetti installa da solo. Questo ADR è l'elenco autorizzato: ciò che non è qui dentro non è stato
deciso, e va aggiunto con un ADR che supera questo.

## Decisione

### Base

| Pacchetto | Perché |
|---|---|
| `vite` | Strumento di sviluppo e compilazione. Avvio istantaneo, che conta perché durante l'asta una correzione va vista subito. |
| `typescript` | I tipi generati dallo schema del database sono il modo in cui frontend e backend restano d'accordo senza riunioni. |
| `react`, `react-dom` | Libreria dell'interfaccia. |
| `@vitejs/plugin-react` | Collegamento fra i due. |

### Applicazione

| Pacchetto | Perché | Alternativa scartata |
|---|---|---|
| `react-router-dom` | Servono indirizzi distinti e condivisibili: la vista personale, quella dell'amministratore e lo **schermo condiviso** devono essere pagine diverse, non la stessa pagina con un interruttore. | Navigazione fatta in casa: si riscrive male ciò che esiste bene. |
| `@supabase/supabase-js` | Client ufficiale del backend scelto in ADR-0001: accesso, dati, canale realtime, archivio file. | Chiamate diffuse a mano: perderemmo il canale realtime. |
| `@tanstack/react-query` | Gestisce cache, ritentativi e riallineamento dei dati del server. Durante un'asta la connessione balla: senza, ogni componente riscriverebbe la stessa logica di ricarica. | Stato scritto a mano: è esattamente il codice che genera i disallineamenti fra dispositivi. |
| `@tanstack/react-virtual` | Il listone ha oltre 500 righe con dieci colonne. Disegnare solo le righe visibili è l'unico modo perché lo scorrimento resti fluido su un telefono. | Paginazione: l'utente ha chiesto una tabella filtrabile e ordinabile, non pagine. |
| `motion` | I bottoni animati e le transizioni sono un requisito esplicito. Rispetta la preferenza di sistema per la riduzione del movimento. | Animazioni in CSS puro: bastano per i bottoni, non per l'entrata delle schede e i coriandoli dell'aggiudicazione. |
| `tailwindcss` e `@tailwindcss/vite` | I colori del design system sono definiti una volta come variabili prese dal logo e usati ovunque per nome. Riduce il rischio, concreto, che qualcuno scriva un colore a mano. | Fogli di stile per componente: più codice e più divergenza. |
| `vite-plugin-pwa` | Rende l'app installabile sulla schermata iniziale, che è il presupposto della decisione ADR-0002. | Configurazione a mano: lavoro inutile, errori facili. |

### Da valutare più avanti, non ancora autorizzate

Queste servono a fette successive e verranno aggiunte quando quelle fette iniziano, con la loro
motivazione:

- lettura di file Excel e CSV, per l'importazione del listone della Fetta 2;
- validazione degli schemi dei dati importati;
- ridimensionamento delle immagini del facepack, nella Fetta 5;
- suoni: si valuterà se serve una libreria o se basta l'audio del browser.

## Conseguenze

**Diventa più facile** · Sapere perché ogni pacchetto è lì, e quindi poterlo togliere quando non
serve più.

**Diventa più difficile** · Aggiungere una dipendenza al volo. È voluto.

**Regola operativa** · Se un comando installa qualcosa che non è in questo elenco, o lo si toglie o
si aggiorna questo ADR con un ADR successivo. Al termine di ogni fetta si confronta l'elenco reale
dei pacchetti con questo documento.

## Reversibilità

**Alta** per quasi tutte. `@supabase/supabase-js` è legato ad ADR-0001 e ne condivide la
reversibilità bassa.
