/**
 * La stagione corrente, in un posto solo.
 *
 * Serve sia alla creazione di una lega sia all'importazione del listone: se il
 * calcolo fosse scritto due volte, prima o poi le due schermate proporrebbero
 * stagioni diverse e nessuno capirebbe perche'.
 */
export function stagioneCorrente(oggi: Date = new Date()): string {
  // Le stagioni cominciano d'estate: da luglio in poi si guarda all'anno dopo.
  const inizio = oggi.getMonth() >= 6 ? oggi.getFullYear() : oggi.getFullYear() - 1
  return `${inizio}/${String((inizio + 1) % 100).padStart(2, '0')}`
}
