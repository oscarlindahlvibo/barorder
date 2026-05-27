import { createClient } from '@supabase/supabase-js';
import { createDemoSupabaseClient } from './demoSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

// The app intentionally supports both the real Supabase client and a local demo client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isDemoMode
  ? createDemoSupabaseClient()
  : createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'barpersonal' | 'lager' | 'admin' | 'personal';

export interface AppUser {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export type RequestStatus = 'mottagen' | 'pa_vag' | 'levererad' | 'kan_ej_levereras';
export type RequestPriority = 'kan_vanta' | 'inom_20' | 'akut' | 'normal';
export type RequestType =
  | 'restock'
  | 'crate_pickup'
  | 'waste_pickup'
  | 'security_call'
  | 'it_support'
  | 'serving_manager';

export interface RestockRequest {
  id: string;
  user_id: string;
  location_id: string;
  request_type?: RequestType;
  priority: RequestPriority;
  note: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  users?: AppUser;
  locations?: Location;
  restock_request_items?: RestockRequestItem[];
}

export interface RestockRequestItem {
  id: string;
  request_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  created_at: string;
  products?: Product;
}

export const CATEGORIES = [
  'Öl',
  'Cider',
  'Vin',
  'Sprit',
  'Drinkmix',
  'Alkoholfria drycker',
  'Is',
  'Muggar',
  'Servetter',
  'Övrigt',
] as const;

export const STATUS_LABELS: Record<RequestStatus, string> = {
  mottagen: 'Mottagen',
  pa_vag: 'Plockas',
  levererad: 'Levererad',
  kan_ej_levereras: 'Kan ej levereras',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  mottagen: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  pa_vag: 'bg-green-500/20 text-green-300 border-green-500/40',
  levererad: 'bg-green-500/20 text-green-300 border-green-500/40',
  kan_ej_levereras: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  restock: 'Påfyllning',
  crate_pickup: 'Tombackar',
  waste_pickup: 'Avfall',
  security_call: 'Ordningsvakt',
  it_support: 'IT-support',
  serving_manager: 'Serveringsansvarig',
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  kan_vanta: 'När tid finns',
  inom_20: 'Inom 20 min',
  akut: 'Akut',
  normal: 'Inom 20 min',
};
