-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 · L'amministratore può eliminare la propria lega
--
-- È l'operazione più distruttiva dell'applicazione: porta via partecipanti,
-- squadre, rose, asta, registro eventi e **le liste obiettivi di tutti**. Non
-- si annulla e non si recupera.
--
-- Per questo non basta un permesso. La funzione chiede di **riscrivere il nome
-- della lega**: un'azione irreversibile non deve poter partire da un tocco
-- sbagliato, né da un client con un difetto. Il controllo sta sul server e non
-- solo nell'interfaccia, perché è lì che deve stare la difesa vera.
--
-- Non esiste una policy di cancellazione su `leagues`: si passa solo di qui.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.esito_eliminazione as enum (
  'ok', 'non_autorizzato', 'lega_inesistente', 'conferma_sbagliata'
);

create or replace function public.elimina_lega(p_lega uuid, p_conferma text)
returns table (
  esito         public.esito_eliminazione,
  messaggio     text,
  partecipanti  int,
  calciatori    int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lega         public.leagues%rowtype;
  v_partecipanti int;
  v_calciatori   int;
begin
  select * into v_lega from public.leagues where id = p_lega;
  if not found then
    return query select 'lega_inesistente'::public.esito_eliminazione,
      'Questa lega non esiste più.', 0, 0; return;
  end if;

  -- Solo l'amministratore, e solo della propria lega.
  if not public.e_admin_lega(p_lega) then
    return query select 'non_autorizzato'::public.esito_eliminazione,
      'Solo l''amministratore della lega può eliminarla.', 0, 0; return;
  end if;

  -- Il nome va riscritto uguale. Si ignorano maiuscole e spazi ai bordi,
  -- perché la difesa serve contro il gesto distratto, non contro chi scrive
  -- con lo shift premuto.
  if lower(btrim(coalesce(p_conferma, ''))) <> lower(btrim(v_lega.name)) then
    return query select 'conferma_sbagliata'::public.esito_eliminazione,
      format('Per eliminarla devi riscrivere il nome esatto: %s', v_lega.name), 0, 0; return;
  end if;

  select count(*)::int into v_partecipanti
  from public.league_members where league_id = p_lega;
  select count(*)::int into v_calciatori
  from public.roster_players where league_id = p_lega;

  -- Tutto il resto se ne va a cascata: partecipanti, squadre, rose, asta,
  -- lotti, offerte, registro e liste obiettivi. Le chiavi esterne sono state
  -- dichiarate per questo fin dalla prima migrazione.
  delete from public.leagues where id = p_lega;

  return query select 'ok'::public.esito_eliminazione,
    format('Lega "%s" eliminata.', v_lega.name), v_partecipanti, v_calciatori;
end;
$$;

comment on function public.elimina_lega(uuid, text) is
  'Elimina una lega e tutto ciò che le appartiene. Chiede di riscrivere il nome: vedi la migrazione 0011.';
