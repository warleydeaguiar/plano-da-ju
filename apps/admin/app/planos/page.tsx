import { createAdminClient } from '../../lib/supabase';
import PlanosClient from './PlanosClient';

export const metadata = { title: 'Revisão de Planos — Admin Plano da Ju' };
export const dynamic = 'force-dynamic';

interface PlanCardData {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  hair_type: string | null;
  porosity: string | null;
  main_problems: string[] | null;
  chemical_history: string | null;
  hair_length_cm: number | null;
  budget_range: string | null;
  quiz_answers: Record<string, unknown> | null;
  approved: boolean;
  created_at: string;
  juliane_notes: string | null;
  stage: 'awaiting_photo' | 'processing' | 'needs_review' | 'approved' | 'no_subscription';
  plan_status: string;
  has_plan: boolean;
  has_photo: boolean;
  photo_url: string | null;
  photo_back_url: string | null;
  photo_root_url: string | null;
  recommended_products: Array<{ produto_id: string; motivo?: string | null; alternativa_id?: string | null }> | null;
  is_gift: boolean;
  subscription_type: string | null;
}

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ gift?: string }>;
}) {
  const sb = createAdminClient();
  const giftMode = (await searchParams).gift === '1';

  // 1) Todas as assinantes ATIVAS — agora com quiz_answers + campos de perfil
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profilesQuery = (sb.from('profiles') as any)
    .select('id,full_name,email,phone,hair_type,porosity,main_problems,chemical_history,hair_length_cm,budget_range,quiz_answers,plan_status,photo_url,photo_back_url,photo_root_url,recommended_products,subscription_status,subscription_activated_at,created_at,is_gift,subscription_type')
    .eq('subscription_status', 'active');
  // Filtro UGC/grátis: server-side. UGC = parceria (Bianca) OU presente (is_gift).
  if (giftMode) profilesQuery = profilesQuery.or('is_gift.eq.true,subscription_type.eq.parceria');
  const { data: profiles } = await profilesQuery
    .order('subscription_activated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(3000); // carrega todas as ativas p/ a busca por nome achar qualquer plano

  const profileList = (profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    hair_type: string | null;
    porosity: string | null;
    main_problems: string[] | null;
    chemical_history: string | null;
    hair_length_cm: number | null;
    budget_range: string | null;
    quiz_answers: Record<string, unknown> | null;
    plan_status: string;
    photo_url: string | null;
    photo_back_url: string | null;
    photo_root_url: string | null;
    recommended_products: Array<{ produto_id: string; motivo?: string | null; alternativa_id?: string | null }> | null;
    subscription_activated_at: string | null;
    created_at: string;
    is_gift: boolean | null;
    subscription_type: string | null;
  }>;

  // 2) hair_plan semana 1 de cada ativa (aprovação + notas).
  // ⚠️ Buscamos em LOTES de 50. Com 200 ids num único .in() a URL passava de
  // 7,5 mil chars e o nginx/Kong respondia 502 → a query falhava INTEIRA,
  // planMap ficava vazio e TODAS as clientes apareciam como "incompleto/
  // travado" (mesmo com plano pronto). Era a causa do "200 travados".
  const userIds = profileList.map(p => p.id);
  const CHUNK = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += CHUNK) chunks.push(userIds.slice(i, i + CHUNK));
  // Antes: os ~60 lotes rodavam em SÉRIE (await dentro do loop) = vários segundos
  // de latência com milhares de ativas. Agora rodam em PARALELO → tempo ≈ 1 query.
  const chunkResults = await Promise.all(chunks.map(slice =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb.from('hair_plans') as any)
      .select('user_id,approved_by_juliane,created_at,juliane_notes')
      .eq('week_number', 1)
      .in('user_id', slice),
  ));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekOnePlans: Array<{ user_id: string; approved_by_juliane: boolean; created_at: string; juliane_notes: string | null }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const { data } of chunkResults) if (Array.isArray(data)) weekOnePlans.push(...(data as any[]));

  const planMap = new Map(
    (weekOnePlans as Array<{ user_id: string; approved_by_juliane: boolean; created_at: string; juliane_notes: string | null }>)
      ?.map(p => [p.user_id, p]) ?? [],
  );

  const cards: PlanCardData[] = profileList.map(p => {
    const plan    = planMap.get(p.id);
    const hasPlan = !!plan;
    const hasPhoto = !!p.photo_url;

    // Entrega é AUTOMÁTICA: plano gerado + status 'ready' = ENTREGUE (não precisa
    // de aprovação manual). 'needs_review' só sobra p/ casos raros (tem plano mas
    // status não-ready). Incompletos reais = sem plano (aguardando foto ou gerando).
    let stage: PlanCardData['stage'];
    if (plan?.approved_by_juliane || (hasPlan && p.plan_status === 'ready')) stage = 'approved';
    else if (hasPlan)               stage = 'needs_review';
    else if (p.plan_status === 'processing') stage = 'processing';
    else if (!hasPhoto)             stage = 'awaiting_photo';
    else                            stage = 'processing';

    return {
      user_id:          p.id,
      full_name:        p.full_name ?? p.email.split('@')[0] ?? 'Anônima',
      email:            p.email,
      phone:            p.phone ?? null,
      hair_type:        p.hair_type,
      porosity:         p.porosity,
      main_problems:    p.main_problems,
      chemical_history: p.chemical_history,
      hair_length_cm:   p.hair_length_cm,
      budget_range:     p.budget_range,
      quiz_answers:     p.quiz_answers ?? null,
      approved:         plan?.approved_by_juliane ?? false,
      created_at:       plan?.created_at ?? p.subscription_activated_at ?? p.created_at,
      juliane_notes:    plan?.juliane_notes ?? null,
      stage,
      plan_status:      p.plan_status,
      has_plan:         hasPlan,
      has_photo:        hasPhoto,
      photo_url:        p.photo_url ?? null,
      photo_back_url:   p.photo_back_url ?? null,
      photo_root_url:   p.photo_root_url ?? null,
      recommended_products: Array.isArray(p.recommended_products) ? p.recommended_products : null,
      is_gift:          !!p.is_gift,
      subscription_type: p.subscription_type ?? null,
    };
  });

  // 3) Pedidos de revisão ABERTOS (fonte da verdade: plan_feedback). Aparecem
  // no topo da tela independentemente do plan_status do perfil — assim um
  // pedido nunca se perde se o status voltar pra 'ready'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openFb } = await (sb.from('plan_feedback') as any)
    .select('id,user_id,email,message,rating,due_at,created_at')
    .eq('status', 'open')
    .not('message', 'is', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(50);

  const fbRows = (openFb ?? []) as Array<{
    id: string; user_id: string; email: string | null; message: string | null;
    rating: number | null; due_at: string | null; created_at: string;
  }>;

  // nomes/telefones dos solicitantes (podem não estar entre as 200 ativas acima)
  const fbUserIds = [...new Set(fbRows.map(f => f.user_id))];
  const fbProfMap = new Map<string, { full_name: string | null; email: string; phone: string | null }>();
  if (fbUserIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fbProfs } = await (sb.from('profiles') as any)
      .select('id,full_name,email,phone')
      .in('id', fbUserIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (fbProfs ?? []) as any[]) fbProfMap.set(p.id, p);
  }

  const revisionRequests = fbRows.map(f => {
    const p = fbProfMap.get(f.user_id);
    return {
      id: f.id,
      user_id: f.user_id,
      full_name: p?.full_name ?? (f.email?.split('@')[0] ?? 'Cliente'),
      email: p?.email ?? f.email ?? '',
      phone: p?.phone ?? null,
      message: f.message ?? '',
      rating: f.rating,
      due_at: f.due_at,
      created_at: f.created_at,
    };
  });

  return <PlanosClient initialCards={cards} revisionRequests={revisionRequests} giftMode={giftMode} />;
}
