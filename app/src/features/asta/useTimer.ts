import { useEffect, useState } from 'react'
import type { Asta, Lotto } from './api'

export type FaseTimer = 'nessuno' | 'attesa' | 'countdown' | 'scaduto'

export type StatoTimer = {
  fase: FaseTimer
  /** Secondi che mancano alla chiusura, arrotondati per eccesso. */
  mancanti: number
  /** Da 0 a 1: quanto del countdown è già passato. Serve all'anello. */
  quota: number
}

/**
 * Lo stato del countdown, ricavato dagli istanti salvati dal server.
 *
 * Non c'è nessun contatore che scorre: c'è `last_bid_at`, l'ora esatta
 * dell'ultimo rilancio, e da lì si ricava tutto. Per questo chi ricarica la
 * pagina a due secondi dalla fine riprende da due secondi, e dieci dispositivi
 * mostrano lo stesso numero. Vedi ADR-0005.
 *
 *     attesa     finché  adesso <  ultimo_rilancio + inattività
 *     countdown  quando  adesso >= ultimo_rilancio + inattività
 *     scaduto    quando  adesso >= ultimo_rilancio + inattività + countdown
 */
export function useTimerAsta(
  lotto: Lotto | null | undefined,
  asta: Asta | null | undefined,
  scartoOrologio: number,
): StatoTimer {
  const [adesso, setAdesso] = useState(() => Date.now())

  useEffect(() => {
    if (!lotto || !asta || asta.status !== 'open') return
    // Dieci volte al secondo: abbastanza per non far saltare un numero,
    // abbastanza poco da non scaldare il telefono.
    const battito = setInterval(() => setAdesso(Date.now()), 100)
    return () => clearInterval(battito)
  }, [lotto, asta])

  if (!lotto || !asta) return { fase: 'nessuno', mancanti: 0, quota: 0 }
  if (asta.status === 'paused') return { fase: 'attesa', mancanti: asta.countdown_seconds, quota: 0 }

  const ultimoRilancio = new Date(lotto.last_bid_at).getTime()
  const trascorsi = (adesso + scartoOrologio - ultimoRilancio) / 1000
  const inizioCountdown = asta.inactivity_seconds
  const fine = asta.inactivity_seconds + asta.countdown_seconds

  if (trascorsi < inizioCountdown) {
    return {
      fase: 'attesa',
      mancanti: Math.ceil(fine - trascorsi),
      quota: 0,
    }
  }
  if (trascorsi < fine) {
    return {
      fase: 'countdown',
      mancanti: Math.ceil(fine - trascorsi),
      quota: (trascorsi - inizioCountdown) / asta.countdown_seconds,
    }
  }
  return { fase: 'scaduto', mancanti: 0, quota: 1 }
}
