-- Enable extensions
create extension if not exists "uuid-ossp";

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,

  -- Hair profile
  hair_type text check (hair_type in ('liso','ondulado','cacheado','crespo')),
  porosity text check (porosity in ('baixa','media','alta')),
  chemical_history text check (chemical_history in ('virgem','colorida','descolorida','alisada','permanente')),
  main_problems text[],
  budget_range text check (budget_range in ('baixo','medio','alto')),
  hair_length_cm numeric,

  -- Quiz
  quiz_answers jsonb,
  quiz_completed_at timestamptz,

  -- Subscription (PagarMe)
  subscription_type text not null default 'none' check (subscription_type in ('annual_card','annual_pix','none')),
  subscription_status text not null default 'pending' check (subscription_status in ('active','expired','cancelled','pending')),
  subscription_expires_at timestamptz,
  pagarme_customer_id text,
  pagarme_subscription_id text,
  pagarme_charge_id text,

  -- Plan delivery flow
  plan_status text not null default 'pending_photo' check (plan_status in ('pending_photo','processing','ready')),
  plan_requested_at timestamptz,
  plan_released_at timestamptz,
  photo_taken_at timestamptz,
  photo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Hair plans (52-week schedule)
create table if not exists public.hair_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_number int not null check (week_number between 1 and 52),
  focus text not null,
  tasks jsonb not null default '[]',
  products text[] not null default '{}',
  tips text[] not null default '{}',
  approved_by_juliane boolean not null default false,
  approved_at timestamptz,
  juliane_notes text,
  created_at timestamptz not null default now(),
  unique (user_id, week_number)
);

alter table public.hair_plans enable row level security;

create policy "Users can view own plan" on public.hair_plans
  for select using (auth.uid() = user_id);

-- Hair events (the heart of predictive system)
create table if not exists public.hair_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null check (event_type in (
    'wash','hydration_mask','nutrition_mask','reconstruction',
    'oil_treatment','heat_used','sun_exposure','cut','chemical'
  )),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.hair_events enable row level security;

create policy "Users can view own hair events" on public.hair_events
  for select using (auth.uid() = user_id);

create policy "Users can insert own hair events" on public.hair_events
  for insert with check (auth.uid() = user_id);

-- Check-ins (smart daily quiz responses)
create table if not exists public.check_ins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  checked_at timestamptz not null default now(),
  hair_feel text check (hair_feel in ('muito_seco','seco','normal','oleoso','otimo')),
  scalp_feel text check (scalp_feel in ('normal','coceira','oleoso','sensivel')),
  breakage_observed boolean,
  questions_asked text[] not null default '{}',
  answers_raw jsonb not null default '{}'
);

alter table public.check_ins enable row level security;

create policy "Users can view own check-ins" on public.check_ins
  for select using (auth.uid() = user_id);

create policy "Users can insert own check-ins" on public.check_ins
  for insert with check (auth.uid() = user_id);

-- Hair state (computed cache — predictive engine)
create table if not exists public.hair_state (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  last_wash_at timestamptz,
  last_hydration_at timestamptz,
  last_nutrition_at timestamptz,
  last_reconstruction_at timestamptz,
  last_oil_at timestamptz,
  days_since_wash int generated always as (
    extract(day from now() - last_wash_at)::int
  ) stored,
  current_condition text check (current_condition in ('muito_seco','seco','normal','oleoso','otimo')),
  updated_at timestamptz not null default now()
);

alter table public.hair_state enable row level security;

create policy "Users can view own hair state" on public.hair_state
  for select using (auth.uid() = user_id);

-- Products catalog
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand text not null,
  category text not null check (category in ('limpeza','hidratacao','nutricao','reconstrucao','finalizacao','tratamento')),
  price_brl numeric(10,2),
  affiliate_url text,
  image_url text,
  hair_types text[] not null default '{}',
  is_iberaparis boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Anyone can view active products" on public.products
  for select using (active = true);

-- Photo analyses (Claude Vision results)
create table if not exists public.photo_analyses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  photo_url text not null,
  brilho_score numeric(3,1) check (brilho_score between 1 and 5),
  hidratacao_score numeric(3,1) check (hidratacao_score between 1 and 5),
  frizz_score numeric(3,1) check (frizz_score between 1 and 5),
  pontas_score numeric(3,1) check (pontas_score between 1 and 5),
  crescimento_estimado_cm numeric(4,1),
  avaliacao_texto text,
  raw_response jsonb,
  analyzed_at timestamptz not null default now()
);

alter table public.photo_analyses enable row level security;

create policy "Users can view own analyses" on public.photo_analyses
  for select using (auth.uid() = user_id);

-- Indexes
create index if not exists hair_events_user_type_idx on public.hair_events(user_id, event_type, occurred_at desc);
create index if not exists check_ins_user_date_idx on public.check_ins(user_id, checked_at desc);
create index if not exists profiles_pagarme_sub_idx on public.profiles(pagarme_subscription_id);

-- Updated_at triggers
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger hair_state_updated_at before update on public.hair_state
  for each row execute procedure public.update_updated_at();
