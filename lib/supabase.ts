import { createClient } from '@supabase/supabase-js';

export const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Key must be provided.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

// For backwards compatibility in files that import `supabase` directly
// We use a proxy to lazily initialize it when a method is called
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const client = getSupabase();
    return (client as any)[prop];
  }
});
