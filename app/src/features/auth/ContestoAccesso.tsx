import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'

type StatoAccesso = {
  /** Vero finche' non sappiamo se c'e' una sessione. Evita di mostrare il login a chi e' gia' dentro. */
  inCaricamento: boolean
  sessione: Session | null
  utente: User | null
  /** Il nome che l'utente ha scelto di mostrare agli altri. */
  nomeMostrato: string | null
  entraConGoogle: () => Promise<void>
  entraConEmail: (email: string, password: string) => Promise<void>
  registrati: (email: string, password: string, nome: string) => Promise<{ serveConferma: boolean }>
  esci: () => Promise<void>
}

const Contesto = createContext<StatoAccesso | null>(null)

export function FornitoreAccesso({ children }: { children: ReactNode }) {
  const [inCaricamento, setInCaricamento] = useState(true)
  const [sessione, setSessione] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) {
      setInCaricamento(false)
      return
    }
    let vivo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSessione(data.session)
      setInCaricamento(false)
    })

    const { data: iscrizione } = supabase.auth.onAuthStateChange((_evento, nuova) => {
      setSessione(nuova)
      setInCaricamento(false)
    })

    return () => {
      vivo = false
      iscrizione.subscription.unsubscribe()
    }
  }, [])

  const entraConGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Backend non configurato')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/leghe` },
    })
    if (error) throw new Error(messaggioErrore(error))
  }, [])

  const entraConEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Backend non configurato')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(messaggioErrore(error))
  }, [])

  const registrati = useCallback(async (email: string, password: string, nome: string) => {
    if (!supabase) throw new Error('Backend non configurato')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: nome } },
    })
    if (error) throw new Error(messaggioErrore(error))
    // Se il progetto richiede la conferma via email, la sessione non c'e' ancora.
    // Lo diciamo a chi chiama, che lo dira' all'utente: mai far credere di essere entrati.
    return { serveConferma: data.session === null }
  }, [])

  const esci = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const valore = useMemo<StatoAccesso>(() => {
    const utente = sessione?.user ?? null
    const metadati = utente?.user_metadata as Record<string, unknown> | undefined
    const nomeMostrato =
      (typeof metadati?.display_name === 'string' && metadati.display_name) ||
      (typeof metadati?.full_name === 'string' && metadati.full_name) ||
      (typeof metadati?.name === 'string' && metadati.name) ||
      utente?.email?.split('@')[0] ||
      null

    return {
      inCaricamento,
      sessione,
      utente,
      nomeMostrato,
      entraConGoogle,
      entraConEmail,
      registrati,
      esci,
    }
  }, [inCaricamento, sessione, entraConGoogle, entraConEmail, registrati, esci])

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useAccesso(): StatoAccesso {
  const valore = useContext(Contesto)
  if (!valore) throw new Error('useAccesso va usato dentro <FornitoreAccesso>')
  return valore
}
