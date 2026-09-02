-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 · Profili utente
--
-- Prima migrazione di Fantasta. Crea la tabella dei profili e, nella STESSA
-- migrazione, le sue regole di accesso: e' la regola 2 di CLAUDE.md, e serve a
-- rendere impossibile una tabella senza permessi.
--
-- L'identita' (email, password, collegamento con Google) e' gestita dal
-- servizio di autenticazione nello schema `auth`. Qui teniamo solo cio' che
-- serve mostrare agli altri partecipanti.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Il nome che l'utente sceglie di far vedere agli altri.
  -- Il limite minimo e' 1 e non 2: il valore di ripiego e' ricavato
  -- dall'indirizzo email, che potrebbe essere brevissimo. Il minimo di 2
  -- caratteri lo chiede l'interfaccia, dove si puo' spiegare perche'.
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Profilo pubblico di un utente. Vedi docs/03-modello-dati.md';

-- ─── Regole di accesso: negato per impostazione predefinita ─────────────────

alter table public.profiles enable row level security;

-- Per ora ognuno vede solo se stesso. Quando esisteranno le leghe, la
-- migrazione che le crea AMPLIERA' questa politica ai compagni di lega:
-- non si apre in anticipo un accesso che ancora non serve a nessuno.
create policy "profilo: leggo il mio"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profilo: aggiorno il mio"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Nessuna politica di inserimento e nessuna di cancellazione: le righe le
-- crea il trigger qui sotto e le cancella la cancellazione dell'utente.
-- Un utente non puo' crearsi profili altrui ne' cancellare il proprio a meta'.

-- ─── Il profilo nasce insieme all'utente ───────────────────────────────────

create or replace function public.crea_profilo_alla_registrazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- L'ordine dei ripieghi: il nome scelto in fase di registrazione, poi
    -- quello che arriva da Google, poi la parte iniziale dell'email.
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Fantallenatore'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.crea_profilo_alla_registrazione() is
  'Crea il profilo subito dopo la registrazione, cosi'' non esiste mai un utente senza profilo.';

create trigger crea_profilo_dopo_registrazione
  after insert on auth.users
  for each row
  execute function public.crea_profilo_alla_registrazione();

-- ─── Aggiornamento automatico di updated_at ────────────────────────────────

create or replace function public.tocca_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profili_tocca_updated_at
  before update on public.profiles
  for each row
  execute function public.tocca_updated_at();
