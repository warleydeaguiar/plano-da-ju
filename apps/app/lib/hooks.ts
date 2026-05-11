/**
 * Data hooks — fetch + cache de dados Supabase
 *
 * - useHairPlan: cronograma de 52 semanas (hair_plans)
 * - useHairState: estado capilar atual (hair_state)
 * - useHairEvents: eventos recentes (hair_events)
 * - useCheckIns: check-ins recentes
 * - useDaysSinceWash: derivado de hair_state.last_wash_at
 * - useStreak: dias consecutivos com pelo menos 1 evento registrado
 * - usePhotoAnalyses: análises de fotos (photo_analyses)
 * - useProducts: catálogo (products)
 *
 * Padrão: cada hook retorna `{ data, loading, error, refresh }`.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

interface HookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function useSupabaseQuery<T>(
  table: string,
  buildQuery: (uid: string) => Promise<{ data: T | null; error: { message: string } | null }>,
): HookResult<T> {
  const { session } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await buildQuery(session.user.id);
      if (res.error) {
        setError(res.error.message);
        setData(null);
      } else {
        setData(res.data);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
      setData(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, table]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ===== Tipos =====

export interface HairPlan {
  id: string;
  week_number: number;
  focus: string;
  tasks: Array<{ day?: number; title: string; description?: string } | string>;
  products: string[];
  tips: string[];
  approved_by_juliane: boolean;
  juliane_notes: string | null;
}

export interface HairState {
  user_id: string;
  last_wash_at: string | null;
  last_hydration_at: string | null;
  last_nutrition_at: string | null;
  last_reconstruction_at: string | null;
  last_oil_at: string | null;
  days_since_wash: number | null;
  current_condition: string | null;
}

export interface HairEvent {
  id: string;
  user_id: string;
  event_type:
    | 'wash'
    | 'hydration_mask'
    | 'nutrition_mask'
    | 'reconstruction'
    | 'oil_treatment'
    | 'heat_used'
    | 'sun_exposure'
    | 'cut'
    | 'chemical';
  occurred_at: string;
  notes: string | null;
}

export interface CheckIn {
  id: string;
  user_id: string;
  checked_at: string;
  hair_feel: string | null;
  scalp_feel: string | null;
  breakage_observed: boolean | null;
}

export interface PhotoAnalysis {
  id: string;
  user_id: string;
  photo_url: string;
  brilho_score: number | null;
  hidratacao_score: number | null;
  frizz_score: number | null;
  pontas_score: number | null;
  crescimento_estimado_cm: number | null;
  avaliacao_texto: string | null;
  analyzed_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_brl: number | null;
  affiliate_url: string | null;
  image_url: string | null;
  hair_types: string[];
  is_iberaparis: boolean;
}

// ===== Hooks =====

export function useHairPlan() {
  return useSupabaseQuery<HairPlan[]>('hair_plans', async uid => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (supabase.from('hair_plans') as any)
      .select(
        'id,week_number,focus,tasks,products,tips,approved_by_juliane,juliane_notes',
      )
      .eq('user_id', uid)
      .order('week_number');
  });
}

export function useHairState() {
  return useSupabaseQuery<HairState>('hair_state', async uid => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (supabase.from('hair_state') as any)
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
  });
}

export function useHairEvents(limit = 30) {
  return useSupabaseQuery<HairEvent[]>('hair_events', async uid => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (supabase.from('hair_events') as any)
      .select('id,user_id,event_type,occurred_at,notes')
      .eq('user_id', uid)
      .order('occurred_at', { ascending: false })
      .limit(limit);
  });
}

export function useCheckIns(limit = 14) {
  return useSupabaseQuery<CheckIn[]>('check_ins', async uid => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (supabase.from('check_ins') as any)
      .select('id,user_id,checked_at,hair_feel,scalp_feel,breakage_observed')
      .eq('user_id', uid)
      .order('checked_at', { ascending: false })
      .limit(limit);
  });
}

export function usePhotoAnalyses(limit = 10) {
  return useSupabaseQuery<PhotoAnalysis[]>('photo_analyses', async uid => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (supabase.from('photo_analyses') as any)
      .select(
        'id,user_id,photo_url,brilho_score,hidratacao_score,frizz_score,pontas_score,crescimento_estimado_cm,avaliacao_texto,analyzed_at',
      )
      .eq('user_id', uid)
      .order('analyzed_at', { ascending: false })
      .limit(limit);
  });
}

export function useProducts(category?: string) {
  return useSupabaseQuery<Product[]>('products', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from('products') as any).select('*').eq('active', true);
    if (category) q = q.eq('category', category);
    return await q.order('is_iberaparis', { ascending: false }).order('name');
  });
}

// ===== Mutations =====

export async function logHairEvent(
  userId: string,
  eventType: HairEvent['event_type'],
  notes?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('hair_events') as any).insert({
    user_id: userId,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    notes: notes ?? null,
  });
  if (error) throw error;

  // Atualizar hair_state também
  const stateUpdate: Record<string, string> = {};
  const now = new Date().toISOString();
  if (eventType === 'wash') stateUpdate.last_wash_at = now;
  if (eventType === 'hydration_mask') stateUpdate.last_hydration_at = now;
  if (eventType === 'nutrition_mask') stateUpdate.last_nutrition_at = now;
  if (eventType === 'reconstruction') stateUpdate.last_reconstruction_at = now;
  if (eventType === 'oil_treatment') stateUpdate.last_oil_at = now;

  if (Object.keys(stateUpdate).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('hair_state') as any).upsert({
      user_id: userId,
      ...stateUpdate,
    });
  }
}

export async function saveCheckIn(
  userId: string,
  payload: {
    hair_feel?: string;
    scalp_feel?: string;
    breakage_observed?: boolean;
    questions_asked?: string[];
    answers_raw?: Record<string, unknown>;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('check_ins') as any).insert({
    user_id: userId,
    checked_at: new Date().toISOString(),
    ...payload,
  });
  if (error) throw error;
}

// ===== Derivações =====

/**
 * Calcula streak de dias consecutivos com algum evento registrado.
 * Olha hair_events; se há evento hoje OU ontem, o streak continua.
 * Se há gap de 2+ dias, streak quebra.
 */
export function calcStreak(events: HairEvent[]): number {
  if (events.length === 0) return 0;
  const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
  const days = new Set(events.map(e => dayKey(e.occurred_at)));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      // primeiro miss após hoje quebra; aceita que hoje pode não ter ainda
      break;
    }
  }
  return streak;
}

/**
 * Dias desde a última lavagem.
 */
export function daysSinceWash(state: HairState | null): number | null {
  if (!state?.last_wash_at) return null;
  const last = new Date(state.last_wash_at).getTime();
  const ms = Date.now() - last;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
