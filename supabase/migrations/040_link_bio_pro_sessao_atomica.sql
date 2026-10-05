-- Link na Bio PRO — gravação da sessão atômica (05/10/2026).
--
-- A rota fazia SELECT e depois INSERT: dois cliques rápidos (ou cold start da
-- Vercel) criavam DUAS linhas pra mesma sessão, e daí em diante todo
-- `.maybeSingle()` falhava — a cliente ficava presa na foto sem conseguir
-- pagar. Agora: índice único + uma função que faz tudo num comando só.
--
-- Regras da função:
--   * `respostas` é o estado COMPLETO mandado pelo navegador (ele é a fonte da
--     verdade — assim trocar de profissão apaga as respostas da profissão
--     anterior). `seq` (timestamp do navegador) impede que uma requisição que
--     chegou atrasada sobrescreva um estado mais novo.
--   * Pedido já PAGO não muda mais (antes uma 2ª compra no mesmo celular
--     sobrescrevia o pedido pago).
--   * `etapa_*` guarda a etapa mais avançada; UTMs guardam o primeiro toque.

create unique index if not exists bio_pro_orders_session_uniq on bio_pro_orders (session_id);

alter table bio_pro_orders add column if not exists seq bigint not null default 0;

create or replace function bio_pro_salvar(
  p_session_id text,
  p_seq        bigint,
  p_respostas  jsonb,
  p_campos     jsonb,
  p_imagem     jsonb
) returns table (id uuid, status_pagamento text)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into bio_pro_orders as o (
    session_id, seq, respostas, nome, email, telefone, profissao,
    etapa_id, etapa_indice, utm_source, utm_medium, utm_campaign,
    tracking_session_id, imagens
  ) values (
    p_session_id,
    coalesce(p_seq, 0),
    coalesce(p_respostas, '{}'::jsonb),
    nullif(p_campos->>'nome', ''),
    nullif(p_campos->>'email', ''),
    nullif(p_campos->>'telefone', ''),
    nullif(p_campos->>'profissao', ''),
    nullif(p_campos->>'etapa_id', ''),
    (p_campos->>'etapa_indice')::int,
    nullif(p_campos->>'utm_source', ''),
    nullif(p_campos->>'utm_medium', ''),
    nullif(p_campos->>'utm_campaign', ''),
    nullif(p_campos->>'tracking_session_id', ''),
    case when p_imagem is null then '[]'::jsonb else jsonb_build_array(p_imagem) end
  )
  on conflict (session_id) do update set
    respostas = case
      when p_respostas is not null and excluded.seq >= o.seq then excluded.respostas
      else o.respostas end,
    profissao = case
      when p_respostas is not null and excluded.seq >= o.seq then coalesce(excluded.profissao, o.profissao)
      else o.profissao end,
    seq = greatest(o.seq, excluded.seq),
    nome = coalesce(excluded.nome, o.nome),
    email = coalesce(excluded.email, o.email),
    telefone = coalesce(excluded.telefone, o.telefone),
    etapa_id = case
      when excluded.etapa_indice is not null
       and (o.etapa_indice is null or excluded.etapa_indice >= o.etapa_indice) then excluded.etapa_id
      else o.etapa_id end,
    etapa_indice = greatest(o.etapa_indice, excluded.etapa_indice),
    utm_source = coalesce(o.utm_source, excluded.utm_source),
    utm_medium = coalesce(o.utm_medium, excluded.utm_medium),
    utm_campaign = coalesce(o.utm_campaign, excluded.utm_campaign),
    tracking_session_id = coalesce(excluded.tracking_session_id, o.tracking_session_id),
    imagens = case when p_imagem is null then o.imagens else o.imagens || jsonb_build_array(p_imagem) end,
    atualizado_em = now()
  where o.status_pagamento <> 'pago';

  return query
    select b.id, b.status_pagamento from bio_pro_orders b where b.session_id = p_session_id;
end;
$$;

revoke all on function bio_pro_salvar(text, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function bio_pro_salvar(text, bigint, jsonb, jsonb, jsonb) to service_role;

-- Bucket só de imagem (antes aceitava qualquer arquivo = hospedagem grátis).
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif']
 where id = 'bio-pro-uploads';
