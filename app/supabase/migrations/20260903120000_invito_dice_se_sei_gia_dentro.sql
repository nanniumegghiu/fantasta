-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 · L'anteprima dell'invito dice se sei già dentro
--
-- PERCHE' CAMBIA
--
-- Chi fa già parte di una lega e riapre il link ricevuto su WhatsApp veniva
-- trattato come un estraneo: gli si chiedeva un nome di squadra, lo si faceva
-- premere «Entra nella lega», e solo dopo tutto il giro il server rispondeva
-- che era già dentro.
--
-- Il server aveva ragione a rispondere così, ma la risposta arrivava troppo
-- tardi: la domanda «vuoi entrare?» non andava proprio fatta. Il link di
-- invito gira su WhatsApp e viene riaperto continuamente, anche solo per
-- ritrovare la lega: è un caso normale, non un errore.
--
-- L'anteprima ora dice anche se chi guarda è già dentro, e con quale lega, in
-- modo che la schermata possa proporgli di andarci invece di farlo ricominciare.
--
-- L'identificativo della lega viene restituito **solo a chi ne fa già parte**:
-- a un estraneo con un codice valido serve il nome per riconoscerla, non un
-- identificativo da usare altrove.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.anteprima_invito(text);

create or replace function public.anteprima_invito(p_codice text)
returns table (
  nome           text,
  stagione       text,
  partecipanti   int,
  massimo        int,
  aperta         boolean,
  sono_gia_dentro boolean,
  lega           uuid,
  mia_squadra    text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    l.name,
    l.season,
    (select count(*)::int from public.league_members m where m.league_id = l.id),
    l.max_members,
    (l.invite_active and l.status = 'setup'),
    exists (
      select 1 from public.league_members m
      where m.league_id = l.id and m.user_id = (select auth.uid())
    ),
    case
      when exists (
        select 1 from public.league_members m
        where m.league_id = l.id and m.user_id = (select auth.uid())
      ) then l.id
      else null
    end,
    (select t.name from public.teams t
     where t.league_id = l.id and t.user_id = (select auth.uid()))
  from public.leagues l
  where l.invite_code = upper(btrim(p_codice));
$$;

comment on function public.anteprima_invito(text) is
  'Cosa mostrare a chi apre un link di invito, compreso il caso di chi è già dentro. Vedi la migrazione 0013.';
