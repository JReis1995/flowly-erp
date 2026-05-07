import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLeadInternalNotificationEmail, sendLeadRequestReceivedEmail } from '@/lib/email'

type LeadPayload = {
  nome?: string
  email?: string
  empresa?: string
  tipoProjeto?: string
  tipoProjetoOutro?: string
  objetivoPrincipal?: string
  utilizadores?: string
  integracoes?: string
  integracoesOutra?: string
  orcamento?: string
  modalidadeManutencao?: string
  descricao?: string
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LeadPayload

    const nome = sanitizeText(body.nome, 120)
    const email = sanitizeText(body.email, 180).toLowerCase()
    const empresa = sanitizeText(body.empresa, 160)
    const tipoProjeto = sanitizeText(body.tipoProjeto, 120)
    const tipoProjetoOutro = sanitizeText(body.tipoProjetoOutro, 160)
    const objetivoPrincipal = sanitizeText(body.objetivoPrincipal, 120)
    const utilizadores = sanitizeText(body.utilizadores, 60)
    const integracoes = sanitizeText(body.integracoes, 120)
    const integracoesOutra = sanitizeText(body.integracoesOutra, 160)
    const orcamento = sanitizeText(body.orcamento, 120)
    const modalidadeManutencao = sanitizeText(body.modalidadeManutencao, 120)
    const descricao = sanitizeText(body.descricao, 4000)

    if (!nome || nome.length < 2) {
      return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }
    if (!tipoProjeto) {
      return NextResponse.json({ error: 'Tipo de projeto é obrigatório.' }, { status: 400 })
    }
    if (tipoProjeto === 'outro' && tipoProjetoOutro.length < 3) {
      return NextResponse.json(
        { error: 'Indica qual é o tipo de projeto pretendido.' },
        { status: 400 }
      )
    }
    if (descricao.trim().length < 10) {
      return NextResponse.json(
        { error: 'Descreve o teu pedido com pelo menos 10 caracteres nas observações.' },
        { status: 400 }
      )
    }
    if (integracoes === 'sim-outras' && integracoesOutra.length < 3) {
      return NextResponse.json(
        { error: 'Indica quais as integrações pretendidas.' },
        { status: 400 }
      )
    }

    const admin = createServiceClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Servidor sem configuração de escrita (SUPABASE_SERVICE_ROLE_KEY).' },
        { status: 503 }
      )
    }

    const { data, error } = await admin
      .from('leads_inbound')
      .insert({
        nome,
        email,
        empresa: empresa || null,
        tipo_projeto: tipoProjeto,
        orcamento: orcamento || null,
        descricao,
        origem: 'website',
        estado: 'new',
        metadata: {
          tipo_projeto_outro: tipoProjeto === 'outro' ? tipoProjetoOutro || null : null,
          objetivo_principal: objetivoPrincipal || null,
          utilizadores_estimados: utilizadores || null,
          integracoes: integracoes || null,
          integracoes_outras: integracoes === 'sim-outras' ? integracoesOutra || null : null,
          modalidade_manutencao: modalidadeManutencao || null,
          user_agent: req.headers.get('user-agent') ?? null,
          referer: req.headers.get('referer') ?? null,
        },
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[api/leads] erro ao inserir lead:', error)
      return NextResponse.json({ error: 'Não foi possível guardar o pedido.' }, { status: 500 })
    }

    const notificationEmail =
      process.env.LEADS_NOTIFICATION_EMAIL?.trim() || 'comercial@inbound.flowly.pt'

    if (process.env.NODE_ENV === 'development') {
      console.log('[api/leads] notificação interna (to):', notificationEmail)
    }

    const emailJobs = Promise.allSettled([
      sendLeadRequestReceivedEmail({
        to: email,
        nome,
        tipoProjeto,
      }),
      sendLeadInternalNotificationEmail({
        to: notificationEmail,
        nome,
        email,
        empresa: empresa || null,
        tipoProjeto,
        tipoProjetoOutro: tipoProjeto === 'outro' ? tipoProjetoOutro || null : null,
        objetivoPrincipal: objetivoPrincipal || null,
        utilizadores: utilizadores || null,
        integracoes: integracoes || null,
        integracoesOutra: integracoes === 'sim-outras' ? integracoesOutra || null : null,
        orcamento: orcamento || null,
        modalidadeManutencao: modalidadeManutencao || null,
        descricao: descricao || null,
      }),
    ])

    try {
      const settled = await withTimeout(emailJobs, 1200)
      settled.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[api/leads] falha no envio de email #${index + 1}:`, result.reason)
          return
        }
        if (!result.value.success) {
          console.error(`[api/leads] email #${index + 1} retornou erro:`, result.value.error)
        }
      })
    } catch (dispatchError) {
      console.error('[api/leads] timeout no disparo de emails:', dispatchError)
    }

    return NextResponse.json({ success: true, leadId: data.id }, { status: 201 })
  } catch (error) {
    console.error('[api/leads] erro inesperado:', error)
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }
}

