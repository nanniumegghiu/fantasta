import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type {
  AnteprimaInvito,
  LegaCompleta,
  Profilo,
  RegoleLega,
  RisultatoIngresso,
} from './tipi'

const CAMPI_LEGA =
  '*, teams(id,league_id,user_id,name,credits_remaining), league_members(league_id,user_id,role,joined_at)'

/** Le leghe di cui faccio parte. Le regole di accesso filtrano gia' il resto. */
export function useMieLeghe() {
  return useQuery({
    queryKey: ['leghe'],
    queryFn: async (): Promise<LegaCompleta[]> => {
      const { data, error } = await richiediSupabase()
        .from('leagues')
        .select(CAMPI_LEGA)
        .order('created_at', { ascending: false })
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []) as unknown as LegaCompleta[]
    },
  })
}

export function useLega(id: string | undefined) {
  return useQuery({
    queryKey: ['lega', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<LegaCompleta | null> => {
      const { data, error } = await richiediSupabase()
        .from('leagues')
        .select(CAMPI_LEGA)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw new Error(messaggioErrore(error))
      return (data as unknown as LegaCompleta) ?? null
    },
  })
}

/** I nomi dei partecipanti. Le policy mostrano solo i compagni di lega. */
export function useProfili(idUtenti: string[]) {
  const chiave = [...idUtenti].sort().join(',')
  return useQuery({
    queryKey: ['profili', chiave],
    enabled: idUtenti.length > 0,
    queryFn: async (): Promise<Record<string, Profilo>> => {
      const { data, error } = await richiediSupabase()
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', idUtenti)
      if (error) throw new Error(messaggioErrore(error))
      const per: Record<string, Profilo> = {}
      for (const p of (data ?? []) as Profilo[]) per[p.id] = p
      return per
    },
  })
}

export function useCreaLega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      nome: string
      stagione: string
      nomeSquadra: string
      regole: RegoleLega
    }): Promise<string> => {
      const { data, error } = await richiediSupabase().rpc('crea_lega', {
        p_nome: v.nome,
        p_stagione: v.stagione,
        p_nome_squadra: v.nomeSquadra,
        p_crediti: v.regole.crediti,
        p_slot_p: v.regole.slotP,
        p_slot_d: v.regole.slotD,
        p_slot_c: v.regole.slotC,
        p_slot_a: v.regole.slotA,
        p_offerta_minima: v.regole.offertaMinima,
        p_scambi: v.regole.scambi,
        p_scambi_crediti: v.regole.scambiConCrediti,
        p_max_partecipanti: v.regole.maxPartecipanti,
      })
      if (error) throw new Error(messaggioErrore(error))
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leghe'] }),
  })
}

/** Mostra nome e stato della lega a chi ha il codice ma non e' ancora dentro. */
export function useAnteprimaInvito(codice: string) {
  const pulito = codice.trim().toUpperCase()
  return useQuery({
    queryKey: ['anteprima-invito', pulito],
    enabled: pulito.length === 6,
    retry: false,
    queryFn: async (): Promise<AnteprimaInvito | null> => {
      const { data, error } = await richiediSupabase().rpc('anteprima_invito', {
        p_codice: pulito,
      })
      if (error) throw new Error(messaggioErrore(error))
      const righe = (data ?? []) as AnteprimaInvito[]
      return righe[0] ?? null
    },
  })
}

export function useEntraInLega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { codice: string; nomeSquadra: string }): Promise<RisultatoIngresso> => {
      const { data, error } = await richiediSupabase().rpc('entra_in_lega', {
        p_codice: v.codice,
        p_nome_squadra: v.nomeSquadra,
      })
      if (error) throw new Error(messaggioErrore(error))
      const righe = (data ?? []) as RisultatoIngresso[]
      // Il database risponde sempre con una riga di esito: se manca, e' un
      // guasto vero e non va nascosto dietro un messaggio generico.
      if (!righe[0]) throw new Error('Il server non ha risposto come previsto.')
      return righe[0]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leghe'] }),
  })
}

export function useRinominaSquadra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { idSquadra: string; nome: string }) => {
      const { error } = await richiediSupabase()
        .from('teams')
        .update({ name: v.nome.trim() })
        .eq('id', v.idSquadra)
      if (error) throw new Error(messaggioErrore(error))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leghe'] })
      qc.invalidateQueries({ queryKey: ['lega'] })
    },
  })
}

export function useRigeneraCodice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (idLega: string): Promise<string> => {
      const { data, error } = await richiediSupabase().rpc('rigenera_codice_invito', {
        p_lega: idLega,
      })
      if (error) throw new Error(messaggioErrore(error))
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leghe'] })
      qc.invalidateQueries({ queryKey: ['lega'] })
    },
  })
}

export function useImpostaInvitoAttivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { idLega: string; attivo: boolean }) => {
      const { error } = await richiediSupabase().rpc('imposta_invito_attivo', {
        p_lega: v.idLega,
        p_attivo: v.attivo,
      })
      if (error) throw new Error(messaggioErrore(error))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leghe'] })
      qc.invalidateQueries({ queryKey: ['lega'] })
    },
  })
}

// ─── Regolamento in PDF ─────────────────────────────────────────────────────

const SECCHIO = 'regolamenti'

export function useCaricaRegolamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { idLega: string; file: File }) => {
      if (v.file.type !== 'application/pdf') {
        throw new Error('Il regolamento deve essere un file PDF.')
      }
      if (v.file.size > 10 * 1024 * 1024) {
        throw new Error('Il file supera i 10 MB. Comprimilo o alleggeriscilo.')
      }
      const percorso = `${v.idLega}/regolamento.pdf`
      const sb = richiediSupabase()
      const { error } = await sb.storage
        .from(SECCHIO)
        .upload(percorso, v.file, { upsert: true, contentType: 'application/pdf' })
      if (error) throw new Error(messaggioErrore(error))

      const { error: erroreLega } = await sb
        .from('leagues')
        .update({ rules_pdf_path: percorso })
        .eq('id', v.idLega)
      if (erroreLega) throw new Error(messaggioErrore(erroreLega))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leghe'] })
      qc.invalidateQueries({ queryKey: ['lega'] })
    },
  })
}

/**
 * Il PDF sta in un archivio privato: serve un indirizzo firmato a scadenza.
 * Non e' un dettaglio burocratico: un archivio pubblico renderebbe il
 * regolamento leggibile a chiunque indovini l'indirizzo.
 */
export async function indirizzoRegolamento(percorso: string): Promise<string> {
  const { data, error } = await richiediSupabase()
    .storage.from(SECCHIO)
    .createSignedUrl(percorso, 60 * 10)
  if (error) throw new Error(messaggioErrore(error))
  return data.signedUrl
}
