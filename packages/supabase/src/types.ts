export type HairType = 'liso' | 'ondulado' | 'cacheado' | 'crespo';
export type Porosity = 'baixa' | 'media' | 'alta';
export type ChemicalHistory = 'virgem' | 'colorida' | 'descolorida' | 'alisada' | 'permanente';
export type HairFeel = 'muito_seco' | 'seco' | 'normal' | 'oleoso' | 'otimo';
export type ScalpFeel = 'normal' | 'coceira' | 'oleoso' | 'sensivel';
export type HairEventType =
  | 'wash'
  | 'hydration_mask'
  | 'nutrition_mask'
  | 'reconstruction'
  | 'oil_treatment'
  | 'heat_used'
  | 'sun_exposure'
  | 'cut'
  | 'chemical';

export type SubscriptionType = 'annual_card' | 'annual_pix' | 'none';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';
export type PlanStatus = 'pending_photo' | 'processing' | 'ready';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  hair_type: HairType | null;
  porosity: Porosity | null;
  chemical_history: ChemicalHistory | null;
  main_problems: string[] | null;
  budget_range: 'baixo' | 'medio' | 'alto' | null;
  subscription_type: SubscriptionType;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  pagarme_customer_id: string | null;
  pagarme_subscription_id: string | null;
  quiz_answers: Record<string, unknown> | null;
  plan_status: PlanStatus;
  plan_released_at: string | null;
  photo_taken_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HairPlan {
  id: string;
  user_id: string;
  week_number: number;
  focus: string;
  tasks: PlanTask[];
  products: string[];
  tips: string[];
  approved_by_juliane: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface PlanTask {
  day: number;
  action: string;
  icon: string;
  duration_min: number | null;
  product_ids: string[];
}

export interface HairEvent {
  id: string;
  user_id: string;
  event_type: HairEventType;
  occurred_at: string;
  notes: string | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  checked_at: string;
  hair_feel: HairFeel | null;
  scalp_feel: ScalpFeel | null;
  breakage_observed: boolean | null;
  questions_asked: string[];
  answers_raw: Record<string, unknown>;
}

export interface HairState {
  user_id: string;
  last_wash_at: string | null;
  last_hydration_at: string | null;
  last_nutrition_at: string | null;
  last_reconstruction_at: string | null;
  last_oil_at: string | null;
  days_since_wash: number | null;
  current_condition: HairFeel | null;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: 'limpeza' | 'hidratacao' | 'nutricao' | 'reconstrucao' | 'finalizacao' | 'tratamento';
  price_brl: number | null;
  affiliate_url: string | null;
  image_url: string | null;
  hair_types: HairType[];
  is_iberaparis: boolean;
  active: boolean;
}
