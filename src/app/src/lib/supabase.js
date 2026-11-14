import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'رابط_مشروعك_من_supabase';
const supabaseAnonKey = 'مفتاح_anon_العام_من_supabase';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
