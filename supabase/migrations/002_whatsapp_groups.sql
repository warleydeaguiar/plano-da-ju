-- =============================================
-- Grupos WhatsApp — Sistema de distribuição proporcional
-- =============================================

-- Grupos WhatsApp de promoção
CREATE TABLE IF NOT EXISTS public.wg_groups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  jid                TEXT UNIQUE,             -- ID interno do grupo no WhatsApp (ex: 120363xxxxxx@g.us)
  invite_code        TEXT NOT NULL,           -- Código do link (parte após chat.whatsapp.com/)
  invite_link        TEXT NOT NULL,           -- Link completo (https://chat.whatsapp.com/XXXX)
  member_count       INTEGER DEFAULT 0,
  capacity           INTEGER DEFAULT 1024,    -- Limite máximo WhatsApp = 1024
  status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'full', 'archived')),
  is_receiving       BOOLEAN DEFAULT false,   -- Se está aceitando novos membros agora
  evolution_instance TEXT DEFAULT 'grupos-promo',
  last_synced_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wg_groups_receiving ON public.wg_groups (is_receiving) WHERE status = 'active';

-- Log de cliques no link /g/entrar (analytics)
CREATE TABLE IF NOT EXISTS public.wg_redirect_clicks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID REFERENCES public.wg_groups(id) ON DELETE SET NULL,
  ip_hash      TEXT,
  user_agent   TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  referer      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wg_clicks_created ON public.wg_redirect_clicks (created_at);

-- Broadcasts enviados para os grupos
CREATE TABLE IF NOT EXISTS public.wg_broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  message       TEXT NOT NULL,
  media_url     TEXT,
  media_type    TEXT CHECK (media_type IN ('image', 'video', null)),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'done', 'failed')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  total_groups  INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count    INTEGER DEFAULT 0,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wg_broadcasts_scheduled ON public.wg_broadcasts (scheduled_at) WHERE status = 'pending';

-- Resultado do broadcast por grupo
CREATE TABLE IF NOT EXISTS public.wg_broadcast_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID REFERENCES public.wg_broadcasts(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES public.wg_groups(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'failed')),
  error        TEXT,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Eventos de entrada/saída nos grupos (via webhook Evolution)
CREATE TABLE IF NOT EXISTS public.wg_member_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID REFERENCES public.wg_groups(id) ON DELETE CASCADE,
  jid        TEXT,
  action     TEXT CHECK (action IN ('add', 'remove', 'promote', 'demote')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: apenas service_role acessa (painel admin)
ALTER TABLE public.wg_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wg_redirect_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wg_broadcasts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wg_broadcast_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wg_member_events   ENABLE ROW LEVEL SECURITY;
