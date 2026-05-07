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
}

export default async function PlanosPage() {
  const sb = createAdminClient();

  // Pega todos os planos semana 1 (1 por usuária) com info do perfil
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (sb.from('hair_plans') as any)
    .select('user_id,approved_by_juliane,created_at,juliane_notes')
    .eq('week_number', 1)
    .order('created_at', { ascending: false })
    .limit(50);

  const cards: PlanCardData[] = [];
  if (plans?.length) {
    const userIds = (plans as Array<{ user_id: string }>).map(p => p.user_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profs } = await (sb.from('profiles') as any)
      .select('id,full_name,email,hair_type,porosity,main_problems')
      .in('id', userIds);

    const map = new Map(
      (profs as Array<{
        id: string;
        full_name: string | null;
        email: string;
        hair_type: string | null;
        porosity: string | null;
        main_problems: string[] | null;
      }>)?.map(p => [p.id, p]) ?? [],
    );

    for (const p of plans as Array<{
      user_id: string;
      approved_by_juliane: boolean;
      created_at: string;
      juliane_notes: string | null;
    }>) {
      const prof = map.get(p.user_id);
      cards.push({
        user_id: p.user_id,
        full_name: prof?.full_name ?? prof?.email?.split('@')[0] ?? 'Anônima',
        email: prof?.email ?? '',
        hair_type: prof?.hair_type ?? null,
        porosity: prof?.porosity ?? null,
        main_problems: prof?.main_problems ?? null,
        approved: p.approved_by_juliane,
        created_at: p.created_at,
        juliane_notes: p.juliane_notes,
      });
    }
  }

  return <PlanosClient initialCards={cards} />;
}
