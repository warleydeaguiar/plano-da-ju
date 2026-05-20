import { createAdminClient } from '../../lib/supabase';
import PlanosClient from './PlanosClient';

export const metadata = { title: 'Revisão de Planos — Admin Plano da Ju' };
export const dynamic = 'force-dynamic';

interface PlanCardData {
  user_id: string;
  full_name: string;
  email: string;
  hair_type: string | null;
  porosity: string | null;
  main_problems: string[] | null;
  approved: boolean;
  created_at: string;
  juliane_notes: string | null;
  // Novo: estado da pipeline pra Juliane saber o que cada cliente precisa
  stage: 'awaiting_photo' | 'processing' | 'needs_review' | 'approved' | 'no_subscription';
  plan_status: string;
  has_plan: boolean;
  has_photo: boolean;
}

export default async function PlanosPage() {
  const sb = createAdminClient();

  // 1) Todas as assinantes ATIVAS (incluindo as sem plano ainda)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (sb.from('profiles') as any)
    .select('id,full_name,email,hair_type,porosity,main_problems,plan_status,photo_url,subscription_status,subscription_activated_at,created_at')
    .eq('subscription_status', 'active')
    .order('subscription_activated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const profileList = (profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string;
    hair_type: string | null;
    porosity: string | null;
    main_problems: string[] | null;
    plan_status: string;
    photo_url: string | null;
    subscription_activated_at: string | null;
    created_at: string;
  }>;

  // 2) Para cada profile, pega o hair_plan da semana 1 (se existir) para o status de aprovação
  const userIds = profileList.map(p => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weekOnePlans } = userIds.length > 0
    ? await (sb.from('hair_plans') as any)
        .select('user_id,approved_by_juliane,created_at,juliane_notes')
        .eq('week_number', 1)
        .in('user_id', userIds)
    : { data: [] };

  const planMap = new Map(
    (weekOnePlans as Array<{ user_id: string; approved_by_juliane: boolean; created_at: string; juliane_notes: string | null }>)
      ?.map(p => [p.user_id, p]) ?? [],
  );

  const cards: PlanCardData[] = profileList.map(p => {
    const plan = planMap.get(p.id);
    const hasPlan = !!plan;
    const hasPhoto = !!p.photo_url;

    let stage: PlanCardData['stage'];
    if (plan?.approved_by_juliane) stage = 'approved';
    else if (hasPlan) stage = 'needs_review';
    else if (p.plan_status === 'processing') stage = 'processing';
    else if (!hasPhoto) stage = 'awaiting_photo';
    else stage = 'processing'; // tem foto mas plano ainda não foi gerado

    return {
      user_id:        p.id,
      full_name:      p.full_name ?? p.email.split('@')[0] ?? 'Anônima',
      email:          p.email,
      hair_type:      p.hair_type,
      porosity:       p.porosity,
      main_problems:  p.main_problems,
      approved:       plan?.approved_by_juliane ?? false,
      created_at:     plan?.created_at ?? p.subscription_activated_at ?? p.created_at,
      juliane_notes:  plan?.juliane_notes ?? null,
      stage,
      plan_status:    p.plan_status,
      has_plan:       hasPlan,
      has_photo:      hasPhoto,
    };
  });

  return <PlanosClient initialCards={cards} />;
}
