import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dbjdtskrgueclkqinlck.supabase.co'
const supabaseAnonKey = 'sb_publishable_Mi8XqXRgMNRzwU9-uMepkg_RIOE7Aer'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
