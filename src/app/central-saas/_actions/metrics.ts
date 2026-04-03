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

  // Buscar todos os clientes (equipa_flowly da Master DB)
  const { data: clientes, error: clientesError } = await supabase
    .from('equipa_flowly')
    .select('*')

  if (clientesError) {
    console.error('Erro ao buscar clientes:', clientesError)
  }

  // Buscar pacotes IA
  const { data: pacotes, error: pacotesError } = await supabase
    .from('pacotes_ia')
    .select('*')

  if (pacotesError) {
    console.error('Erro ao buscar pacotes IA:', pacotesError)
  }

  // Calcular métricas
  const totalClientes = clientes?.length || 0
  const contasAtivas = clientes?.filter((c: { Status: string }) => c.Status === 'Ativo').length || 0
  const contasInativas = totalClientes - contasAtivas
  
  // Calcular MRR baseado em clientes ativos (estimativa: €29/mês por cliente ativo)
  const valorPorCliente = 29
  const mrrTotal = contasAtivas * valorPorCliente
  
  // Crescimento mensal (simulado - em produção comparar com mês anterior)
  const crescimentoMensal = 12.5

  // Pacotes IA
  const pacotesIAVendidos = pacotes?.filter((p: { Status: string }) => p.Status === 'Ativo').length || 0
  const creditosIADisponiveis = pacotes?.reduce((acc: number, p: { Creditos: number }) => acc + (p.Creditos || 0), 0) || 0

  // Total de colaboradores (equipa Flowly)
  const totalColaboradores = clientes?.filter((c: { Cargo: string }) => 
    c.Cargo && ['Owner', 'Admin', 'Dev'].includes(c.Cargo)
  ).length || 0

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
