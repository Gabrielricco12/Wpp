import { createClient } from '@supabase/supabase-js'

// No Vite, usamos import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.")
}

export const supabase = createClient(supabaseUrl, supabaseKey)