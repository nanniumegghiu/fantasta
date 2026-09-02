---
name: design-system
description: I token visivi del progetto — colori estratti dal logo, tipografia, spaziature, animazioni, suoni — e le regole per usarli. Usala prima di scrivere qualsiasi componente, stile o schermata, e ogni volta che stai per scrivere un colore a mano.
---

# Design system

I colori vengono dal logo in `brand/logo.png`, estratti dai pixel reali. Non se ne inventano altri.

## Token

```css
:root {
  /* Marchio, dai pixel del logo */
  --verde-notte:    #082B1D;  /* sfondo dell'app */
  --verde-campo:    #0E5739;  /* superfici sollevate, schede */
  --verde-acceso:   #449545;  /* conferme, "è un mio obiettivo" */
  --arancio:        #F47918;  /* azione principale: chiama, rilancia */
  --arancio-caldo:  #EB6517;  /* stato premuto */
  --oro:            #F7C443;  /* countdown, aggiudicazione */
  --oro-scuro:      #D79426;  /* bordi e ombre dell'oro */

  /* Neutri */
  --bianco:  #FFFFFF;
  --nebbia:  #E7EDE9;
  --fumo:    #9BB0A5;
  --carbone: #0A1F16;

  /* Semantici */
  --errore:      #E5484D;
  --attenzione:  var(--oro);
  --successo:    var(--verde-acceso);
  --informativo: #3B9EFF;

  /* Ritmo verticale: multipli di 4 */
  --s1: 4px;  --s2: 8px;  --s3: 12px; --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;

  /* Angoli */
  --r-piccolo: 8px;  --r-medio: 14px;  --r-grande: 24px;  --r-pillola: 999px;

  /* Tempi */
  --t-veloce: 120ms;  --t-medio: 240ms;  --t-lento: 400ms;
  --curva: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

## Regole non negoziabili

1. **Nessun colore scritto a mano nei componenti.** Se ti serve una tinta che non c'è, la aggiungi
   qui e la motivi. Un `#1a5c3a` sparso in un file è il modo in cui i temi si rompono.
2. **Il testo su arancio e su oro è `--carbone`, mai bianco.** Il bianco su arancio non raggiunge il
   contrasto minimo ed è illeggibile alla luce del sole.
3. **I numeri usano cifre a larghezza fissa.** Senza, il countdown balla mentre scende.
4. **Area di tocco minima 44 × 44 px.** I bottoni di rilancio sono più grandi: si premono di fretta.
5. **Due scale tipografiche.** Il telefono si guarda da 30 cm, lo schermo condiviso da 3 metri.
   Non ingrandire la scala del telefono: usa quella dello schermo, definita in
   `docs/04-frontend-e-design.md`.
6. **Riduzione del movimento rispettata.** Sotto `prefers-reduced-motion: reduce` niente rimbalzi,
   niente coriandoli, niente pulsazioni. Le stesse informazioni, senza animazione.

## Movimento

| Elemento | Cosa fa | Durata |
|---|---|---|
| Bottone premuto | Scala 0,96 e ombra più corta | `--t-veloce` |
| Rilancio accettato | Il numero sale con un rimbalzo | `--t-medio` |
| Nuova chiamata | La scheda entra dal basso, leggera rotazione | 320 ms |
| Countdown | Pulsazione al secondo, dall'oro al rosso sotto i 3 | 1 s per ciclo |
| Aggiudicazione | Coriandoli brevi, nome squadra che ingrandisce | 900 ms |

## Suoni

Solo sullo **schermo condiviso**, mai sui telefoni. Dieci telefoni che suonano insieme sono rumore.

I file stanno in `app/public/sounds/`, formato `.webm` con ricaduta `.mp3`, ognuno sotto i 40 KB.

| Evento | File | Carattere |
|---|---|---|
| Nuova chiamata | `chiamata` | Fischietto corto |
| Rilancio | `rilancio` | Tocco secco, tono che sale |
| Partenza countdown | `countdown-start` | Tre note discendenti |
| Ultimi 3 secondi | `tick` | Un battito al secondo |
| Aggiudicazione | `martelletto` | Martelletto e coro breve |
| Reparto completato | `campanella` | Campanella |

**Il vincolo da ricordare sempre**: nessun browser fa partire un suono prima di un tocco
dell'utente. Lo schermo condiviso apre su una schermata «Tocca per attivare l'audio». Senza quella
schermata i suoni non partono e sembra un difetto.

## Stati obbligatori di ogni componente

Nessun componente è finito senza tutti e quattro: **normale**, **in caricamento**, **vuoto**,
**in errore**. Lo stato vuoto dice cosa fare, non solo che non c'è niente.

## La prova del nome lungo

Ogni componente che mostra un calciatore o una squadra va provato con il nome più lungo del listone
e con un nome di squadra fantacalcistica di 25 caratteri. Se si taglia, si progetta il taglio: due
righe, oppure puntini con il nome completo raggiungibile.
