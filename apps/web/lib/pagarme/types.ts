export interface PagarMeCustomer {
  name: string;
  email: string;
  type: 'individual';
  document_type?: 'CPF';
  document?: string;
  phones?: { mobile_phone?: { country_code: string; area_code: string; number: string } };
}

export interface PagarMeAddress {
  line_1: string;
  zip_code: string;
  city: string;
  state: string;
  country: string;
}

export interface PagarMeCard {
  number: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  cvv: string;
  billing_address: PagarMeAddress;
}

export interface PagarMePlan {
  id: string;
  name: string;
  status: string;
  currency: string;
  interval: string;
  interval_count: number;
}

export interface PagarMeSubscription {
  id: string;
  status: string;
  customer: { id: string; email: string };
  plan: PagarMePlan;
  current_cycle?: { billing_at: string };
}

export interface PagarMeOrder {
  id: string;
  status: string;
  customer: { id: string };
  charges: PagarMeCharge[];
}

export interface PagarMeCharge {
  id: string;
  status: string;
  payment_method: string;
  last_transaction?: {
    qr_code?: string;
    qr_code_url?: string;
    expires_at?: string;
  };
}

export interface PagarMeWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
}
