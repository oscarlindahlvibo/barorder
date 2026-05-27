import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'barpersonal' | 'lager' | 'admin';

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
export type RequestPriority = 'normal' | 'akut';

export interface RestockRequest {
  id: string;
  user_id: string;
  location_id: string;
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
  pa_vag: 'På väg',
  levererad: 'Levererad',
  kan_ej_levereras: 'Kan ej levereras',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  mottagen: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  pa_vag: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  levererad: 'bg-green-500/20 text-green-300 border-green-500/40',
  kan_ej_levereras: 'bg-red-500/20 text-red-300 border-red-500/40',
};
