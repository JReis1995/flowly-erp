import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  runCalculateEmployeeCosts,
  type CalcInput,
} from '@/lib/rh/calculate-employee-costs-engine'

async function createServerSupabase() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return null
  }
  return createServerClient(url, anon, {
    cookies: {
      get: async (name: string) => cookieStore.get(name)?.value,
      set: async (_name: string, _value: string, _options: CookieOptions) => {},
      remove: async (_name: string, _options: CookieOptions) => {},
    },
  })
}

/**
 * GET — diagnóstico rápido no browser ou curl (confirma que a rota está registada).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      'Motor de custos em Node.js (sem Edge Function obrigatória). POST com JSON: base_salary, contract_start_date, …',
  })
}

/**
 * Cálculo de custos no servidor Next.js (mesma lógica que `supabase/functions/calculate_employee_costs`).
 * Evita depender de deploy em Supabase Functions e de CORS no browser.
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { ok: false, error: 'Supabase não configurado no servidor.' },
      { status: 503 },
    )
  }

  const supabase = await createServerSupabase()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Configuração inválida.' }, { status: 503 })
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Sessão inválida.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corpo do pedido inválido.' }, { status: 400 })
  }

  try {
    const { status, payload } = runCalculateEmployeeCosts(body as CalcInput)
    return NextResponse.json(payload, { status })
  } catch (e) {
    console.error('[calculate-employee-costs]', e)
    return NextResponse.json(
      {
        ok: false,
        error: 'Falha ao calcular. Verifique os dados.',
        detail: e instanceof Error ? e.message : 'Erro interno',
      },
      { status: 500 },
    )
  }
}
