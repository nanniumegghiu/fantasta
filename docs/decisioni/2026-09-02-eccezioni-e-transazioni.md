# Registro · Un limite ai tentativi che non limitava niente

**Data** · 2026-09-02 · **Chi** · backend-engineer, segnalato dalla prova automatica
**Dove** · `entra_in_lega`, migrazione 0002, corretta dalla migrazione 0003

---

## Cosa è successo

La funzione che fa entrare in una lega col codice doveva anche fermare chi prova codici a caso.
La logica sembrava giusta: registra il tentativo fallito, conta i fallimenti degli ultimi dieci
minuti, e se sono troppi rifiuta.

La prova automatica ha fatto dodici tentativi con un codice inesistente. Al dodicesimo la funzione
rispondeva ancora «Codice non valido», invece di «Troppi codici sbagliati». Il limite non scattava
mai.

## Perché

In PostgreSQL una funzione gira dentro **una sola transazione**. Sollevare un'eccezione annulla
tutto ciò che la funzione ha fatto, **compresa la scrittura del tentativo fallito**. La tabella dei
tentativi restava vuota dopo ogni fallimento, quindi il conteggio era sempre zero.

È un errore che si legge male nel codice: la riga che registra il tentativo c'è, è scritta bene, e
sembra fare il suo lavoro. Solo eseguendo si scopre che non lascia traccia.

## Cosa abbiamo scelto

Non un espediente per far sopravvivere la scrittura, ma un cambio di forma della risposta.

Un codice sbagliato **non è un guasto del programma**: è uno degli esiti previsti di un'operazione
normale. Le eccezioni servono a segnalare che qualcosa è andato storto, non a comunicare un
risultato. Quindi la funzione ora restituisce un esito strutturato, con un codice stabile e un
messaggio già in italiano, la transazione va a buon fine e il tentativo resta registrato.

## Cosa abbiamo scartato

- **Transazione autonoma.** PostgreSQL non ce l'ha in modo nativo: servirebbe un'estensione per
  aprire una connessione separata. Complicazione grossa per un problema che si risolve cambiando
  la forma della risposta.
- **Registrare il tentativo dal client, prima della chiamata.** Sarebbe una difesa che il client
  può saltare semplicemente non chiamandola. Una difesa aggirabile non è una difesa.

## Cosa ci portiamo dietro

1. **Nelle funzioni del database, un esito previsto si restituisce, non si solleva.** L'eccezione
   resta per ciò che è davvero anomalo. Questo vale in particolare per tutto il motore d'asta, dove
   «offerta superata» e «ruolo pieno» sono esiti normalissimi e frequenti.
2. **Il vantaggio secondario è diventato il principale.** L'interfaccia ora riceve un codice che può
   riconoscere e un messaggio pronto da mostrare, esattamente come prescrive
   `.claude/skills/contratto-dati/SKILL.md`. La correzione ha migliorato il contratto, non solo il
   comportamento.
3. **La prova ha trovato ciò che la lettura del codice non aveva trovato.** Il limite era stato
   scritto, riletto e considerato fatto. Solo eseguirlo dodici volte ha mostrato che non
   funzionava. È la ragione per cui la regola 4 del progetto dice di verificare e non dichiarare.
