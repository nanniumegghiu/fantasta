/**
 * Traduce gli errori del backend in messaggi che dicono all'utente COSA FARE.
 *
 * Regola da .claude/skills/contratto-dati/SKILL.md: i messaggi di dominio si
 * scrivono in un posto solo. Un errore mostrato come "Errore" per qualsiasi
 * causa, compresa la password sbagliata, e' un difetto, non una scorciatoia.
 */

type ErroreConMessaggio = { message?: string; code?: string; status?: number }

const TRADUZIONI: Array<[RegExp, string]> = [
  [
    /invalid login credentials/i,
    'Email o password non corretti. Controlla e riprova.',
  ],
  [
    /email not confirmed/i,
    "Devi prima confermare l'indirizzo email: cerca il messaggio che ti abbiamo inviato.",
  ],
  [
    /user already registered|already been registered/i,
    'Questo indirizzo è già registrato. Entra con la password, oppure usa Google.',
  ],
  [
    /password should be at least (\d+)/i,
    'La password è troppo corta: servono almeno 8 caratteri.',
  ],
  [
    /unable to validate email address|invalid format/i,
    "L'indirizzo email non sembra valido.",
  ],
  [
    /for security purposes|rate limit|too many requests/i,
    'Troppi tentativi ravvicinati. Aspetta un minuto e riprova.',
  ],
  [
    /network|fetch failed|failed to fetch/i,
    'Non riesco a raggiungere il server. Controlla la connessione.',
  ],
  [
    /provider is not enabled/i,
    "L'accesso con Google non è ancora attivo su questo progetto.",
  ],
]

export function messaggioErrore(errore: unknown): string {
  const grezzo =
    typeof errore === 'string'
      ? errore
      : ((errore as ErroreConMessaggio)?.message ?? '')

  for (const [schema, testo] of TRADUZIONI) {
    if (schema.test(grezzo)) return testo
  }

  // Nessuna traduzione: mostriamo il messaggio vero invece di nasconderlo
  // dietro un generico "Errore". Chi legge deve poter capire o riferire.
  return grezzo || 'Qualcosa è andato storto. Riprova.'
}
