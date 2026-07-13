import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

function getSupabaseProjectUrl(url: string) {
  return new URL(url).origin;
}

export const supabase = isSupabaseConfigured
  ? createClient(getSupabaseProjectUrl(supabaseUrl as string), supabasePublishableKey as string)
  : null;
