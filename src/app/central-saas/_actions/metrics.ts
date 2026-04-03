import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface DashboardMetrics {
  totalClientes: number
  contasAtivas: number
  contasInativas: number
  mrrTotal: number
  crescimentoMensal: number
  pacotesIAVendidos: number
  creditosIADisponiveis: number
  totalColaboradores: number
}

export async function getAdminMetrics(): Promise<DashboardMetrics> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          return (await cookieStore).get(name)?.value
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value, ...options })
        },
        remove: async (name: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value: '', ...options })
        },
      },
    }
  )

  // Valores por defeito - garantem que o fluxo nunca quebra
  let totalClientes = 0
  let contasAtivas = 0
  let contasInativas = 0
  let totalColaboradores = 0
  let pacotesIAVendidos = 0
  let creditosIADisponiveis = 0

  // Buscar tenants (clientes) - envolvido em try/catch para não quebrar o fluxo
  try {
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')

    if (tenantsError) {
      console.error('[Metrics] Erro ao buscar tenants:', tenantsError)
    } else if (tenants) {
      totalClientes = tenants.length
      contasAtivas = tenants.filter((t: { status: string }) => t.status === 'ativo').length
      contasInativas = totalClientes - contasAtivas
    }
  } catch (err) {
    console.error('[Metrics] Exceção ao buscar tenants:', err)
  }

  // NOTA: A tabela flowly_staff não existe na BD (migration não executada)
  // totalColaboradores mantém-se a 0 até a tabela ser criada

  // Buscar pacotes IA - envolvido em try/catch independente
  try {
    const { data: pacotes, error: pacotesError } = await supabase
      .from('pacotes_ia')
      .select('*')

    if (pacotesError) {
      console.error('[Metrics] Erro ao buscar pacotes IA:', pacotesError)
    } else if (pacotes) {
      pacotesIAVendidos = pacotes.filter((p: { status: string }) => p.status === 'Ativo').length
      creditosIADisponiveis = pacotes.reduce((acc: number, p: { creditos: number }) => acc + (p.creditos || 0), 0)
    }
  } catch (err) {
    console.error('[Metrics] Exceção ao buscar pacotes IA:', err)
  }

  // Calcular MRR baseado em clientes ativos (estimativa: €29/mês por cliente ativo)
  const valorPorCliente = 29
  const mrrTotal = contasAtivas * valorPorCliente
  
  // Crescimento mensal (simulado - em produção comparar com mês anterior)
  const crescimentoMensal = 12.5

  return {
    totalClientes,
    contasAtivas,
    contasInativas,
    mrrTotal,
    crescimentoMensal,
    pacotesIAVendidos,
    creditosIADisponiveis,
    totalColaboradores,
  }
}
