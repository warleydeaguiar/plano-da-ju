export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          hair_type: string | null;
          porosity: string | null;
          chemical_history: string | null;
          main_problems: string[] | null;
          budget_range: string | null;
          subscription_type: string;
          subscription_status: string;
          subscription_expires_at: string | null;
          pagarme_customer_id: string | null;
          pagarme_subscription_id: string | null;
          quiz_answers: Json | null;
          plan_status: string;
          plan_released_at: string | null;
          photo_taken_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      hair_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          occurred_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['hair_events']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['hair_events']['Insert']>;
      };
      check_ins: {
        Row: {
          id: string;
          user_id: string;
          checked_at: string;
          hair_feel: string | null;
          scalp_feel: string | null;
          breakage_observed: boolean | null;
          questions_asked: string[];
          answers_raw: Json;
        };
        Insert: Omit<Database['public']['Tables']['check_ins']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['check_ins']['Insert']>;
      };
      hair_state: {
        Row: {
          user_id: string;
          last_wash_at: string | null;
          last_hydration_at: string | null;
          last_nutrition_at: string | null;
          last_reconstruction_at: string | null;
          last_oil_at: string | null;
          days_since_wash: number | null;
          current_condition: string | null;
          updated_at: string;
        };
        Insert: Database['public']['Tables']['hair_state']['Row'];
        Update: Partial<Database['public']['Tables']['hair_state']['Row']>;
      };
      hair_plans: {
        Row: {
          id: string;
          user_id: string;
          week_number: number;
          focus: string;
          tasks: Json;
          products: string[];
          tips: string[];
          approved_by_juliane: boolean;
          approved_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['hair_plans']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['hair_plans']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          brand: string;
          category: string;
          price_brl: number | null;
          affiliate_url: string | null;
          image_url: string | null;
          hair_types: string[];
          is_iberaparis: boolean;
          active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
