import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import {
  isPlatformRhRole,
  resolveManagerCompanyId,
  userManagesCompany,
  type ProfileRow,
} from '@/lib/rh/manager-company'
import { isValidTipoContratoKey, tipoContratoLabelFromKey } from '@/lib/rh/contract-types'

function normalizeNif(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9)
}

async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => cookieStore.get(name)?.value,
        set: async (_name: string, _value: string, _options: CookieOptions) => {},
        remove: async (_name: string, _options: CookieOptions) => {},
      },
    }
  )
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Só em `development`: cria utilizador Auth sem `inviteUserByEmail` (evita rate limit de SMTP). Produção ignora sempre. */
function shouldSkipInviteEmail(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    (process.env.SKIP_INVITE_EMAIL === 'true' || process.env.SKIP_INVITE_EMAIL === '1')
  )
}

function generateDevInitialPassword(): string {
  return randomBytes(18).toString('base64url')
}

function isAuthUserAlreadyExists(err: { message?: string } | null): boolean {
  const msg = err?.message?.toLowerCase() ?? ''
  return (
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('user already exists')
  )
}

type Body = {
  companyId?: string | null
  nome: string
  nif: string
  niss: string
  email: string
  telemovel: string
  tipoContrato: string
  dataInicio: string
  cargo: string
  vencimentoBase: number
  subsidioAlimentacao: number
  subsidioAlimentacaoTipo: 'cartao' | 'dinheiro'
  valorSeguroAcidentes: number
  trabalhaSabado?: boolean
  trabalhaDomingo?: boolean
  contratoTeletrabalho?: boolean
  contratoTempoParcial?: boolean
  contratoModalidadeOutra?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 })
    }

    const body = (await req.json()) as Body
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    const emailNorm = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const nifNorm = normalizeNif(typeof body.nif === 'string' ? body.nif : '')
    const niss = typeof body.niss === 'string' ? body.niss.replace(/\s/g, '') : ''
    const telemovel = typeof body.telemovel === 'string' ? body.telemovel.trim() : ''
    const cargo = typeof body.cargo === 'string' ? body.cargo.trim() : ''
    const dataInicio = typeof body.dataInicio === 'string' ? body.dataInicio.trim() : ''
    const tipoContratoKey = typeof body.tipoContrato === 'string' ? body.tipoContrato.trim() : ''

    if (!nome || nome.length < 2) {
      return NextResponse.json({ error: 'Indique o nome completo.' }, { status: 400 })
    }
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }
    if (nifNorm.length !== 9) {
      return NextResponse.json({ error: 'NIF deve ter 9 dígitos.' }, { status: 400 })
    }
    if (!niss || niss.length < 4) {
      return NextResponse.json({ error: 'NISS inválido.' }, { status: 400 })
    }
    if (!cargo) {
      return NextResponse.json({ error: 'Indique o cargo.' }, { status: 400 })
    }
    if (!dataInicio || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      return NextResponse.json({ error: 'Data de início inválida (AAAA-MM-DD).' }, { status: 400 })
    }
    if (!isValidTipoContratoKey(tipoContratoKey)) {
      return NextResponse.json({ error: 'Tipo de contrato inválido.' }, { status: 400 })
    }
    if (!['cartao', 'dinheiro'].includes(body.subsidioAlimentacaoTipo)) {
      return NextResponse.json({ error: 'Modalidade de subsídio inválida.' }, { status: 400 })
    }
    const vencimentoBase = Number(body.vencimentoBase)
    const subsidioAlimentacao = Number(body.subsidioAlimentacao)
    const valorSeguroAcidentes = Number(body.valorSeguroAcidentes)
    if (!Number.isFinite(vencimentoBase) || vencimentoBase < 0) {
      return NextResponse.json({ error: 'Vencimento base inválido.' }, { status: 400 })
    }
    if (!Number.isFinite(subsidioAlimentacao) || subsidioAlimentacao < 0) {
      return NextResponse.json({ error: 'Subsídio de alimentação inválido.' }, { status: 400 })
    }
    if (!Number.isFinite(valorSeguroAcidentes) || valorSeguroAcidentes < 0) {
      return NextResponse.json({ error: 'Valor do seguro inválido.' }, { status: 400 })
    }

    const admin = createServiceClient()
    if (!admin) {
      return NextResponse.json(
        {
          error:
            'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Necessário para ler perfil (evita RLS recursivo) e para convites por email.',
        },
        { status: 503 }
      )
    }

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', session.user.id)
      .single()

    if (profileErr) {
      console.error('[colaboradores/criar] profile', profileErr)
      return NextResponse.json({ error: 'Não foi possível ler o perfil.' }, { status: 500 })
    }

    const p = profile as ProfileRow
    const platform = isPlatformRhRole(p.role)

    const fromBodyCompany =
      typeof body.companyId === 'string' && body.companyId.trim() ? body.companyId.trim() : ''

    let companyId: string | null = null
    if (platform) {
      // Preferência: empresa escolhida no pedido → tenant no perfil → mesma resolução que um gestor
      // (superadmin/developer muitas vezes têm tenant_id NULL no perfil mas estão em tenant_users ou como gestor_email).
      if (fromBodyCompany) {
        companyId = fromBodyCompany
      } else if (p.tenant_id) {
        companyId = p.tenant_id
      } else {
        companyId = await resolveManagerCompanyId(
          supabase,
          session.user.id,
          session.user.email ?? undefined,
          p
        )
      }
    } else {
      companyId = fromBodyCompany || (await resolveManagerCompanyId(
        supabase,
        session.user.id,
        session.user.email ?? undefined,
        p
      ))
    }

    if (!companyId) {
      return NextResponse.json(
        {
          error:
            'Não foi possível determinar a empresa. Administradores de plataforma sem tenant no perfil devem escolher a empresa no formulário, ou associe a sua conta (email de gestor da empresa, ou registo em tenant_users).',
        },
        { status: 400 }
      )
    }

    const manages = await userManagesCompany(
      supabase,
      session.user.id,
      session.user.email ?? undefined,
      companyId,
      p
    )
    if (!manages) {
      return NextResponse.json({ error: 'Sem permissão para criar colaboradores nesta empresa.' }, { status: 403 })
    }

    const { data: tenantOk } = await supabase.from('tenants').select('id').eq('id', companyId).maybeSingle()
    if (!tenantOk?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const { data: dupNif } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('nif', nifNorm)
      .maybeSingle()
    if (dupNif) {
      return NextResponse.json({ error: 'Já existe um colaborador com este NIF nesta empresa.' }, { status: 409 })
    }

    const { data: dupEmail } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .ilike('email', emailNorm)
      .maybeSingle()
    if (dupEmail) {
      return NextResponse.json(
        { error: 'Já existe um colaborador com este email nesta empresa.' },
        { status: 409 }
      )
    }

    const skipInvite = shouldSkipInviteEmail()
    let devInitialPassword: string | undefined

    let newUserId: string

    if (skipInvite) {
      devInitialPassword = generateDevInitialPassword()
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailNorm,
        password: devInitialPassword,
        email_confirm: true,
        user_metadata: { full_name: nome },
      })
      if (createErr || !created?.user?.id) {
        if (isAuthUserAlreadyExists(createErr ?? null)) {
          return NextResponse.json(
            {
              error: 'Este email já está registado na plataforma. Use outro email ou recupere a conta existente.',
            },
            { status: 409 },
          )
        }
        console.error('[colaboradores/criar] createUser (dev skip invite)', createErr)
        return NextResponse.json(
          {
            error: createErr?.message ?? 'Falha ao criar utilizador (modo dev sem convite).',
            detail: createErr?.message,
          },
          { status: 502 },
        )
      }
      newUserId = created.user.id
    } else {
      const origin = req.nextUrl.origin
      const redirectTo = `${origin}/definir-senha`

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(emailNorm, {
        data: { full_name: nome },
        redirectTo,
      })

      if (inviteError || !invited?.user?.id) {
        const msg = inviteError?.message?.toLowerCase() ?? ''
        const code = inviteError && 'code' in inviteError ? String(inviteError.code) : ''
        if (isAuthUserAlreadyExists(inviteError ?? null)) {
          return NextResponse.json(
            {
              error: 'Este email já está registado na plataforma. Use outro email ou recupere a conta existente.',
            },
            { status: 409 },
          )
        }
        if (
          code === 'over_email_send_rate_limit' ||
          msg.includes('rate limit') ||
          msg.includes('email rate limit')
        ) {
          return NextResponse.json(
            {
              error:
                'Limite de envio de emails do Supabase atingido (muitos convites em pouco tempo). Aguarde alguns minutos, use outro projeto de teste ou configure SMTP próprio no Supabase. Em desenvolvimento local pode definir SKIP_INVITE_EMAIL=true no .env.local.',
              detail: inviteError?.message,
            },
            { status: 429 },
          )
        }
        console.error('[colaboradores/criar] invite', inviteError)
        return NextResponse.json(
          { error: inviteError?.message ?? 'Falha ao enviar convite por email.', detail: inviteError?.message },
          { status: 502 },
        )
      }
      newUserId = invited.user.id
    }

    const { error: insertProfileError } = await admin.from('profiles').insert({
      id: newUserId,
      nome,
      role: 'colaborador',
      tenant_id: companyId,
    })

    if (insertProfileError) {
      console.error('[colaboradores/criar] profile insert', insertProfileError)
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        {
          error: 'Não foi possível criar o perfil do colaborador.',
          detail: insertProfileError.message,
        },
        { status: 500 },
      )
    }

    const tipoContrato = tipoContratoLabelFromKey(tipoContratoKey)
    const trabalhaSabado =
      typeof body.trabalhaSabado === 'boolean' ? body.trabalhaSabado : null
    const trabalhaDomingo =
      typeof body.trabalhaDomingo === 'boolean' ? body.trabalhaDomingo : null

    /** Colunas alinhadas com migrações Sprint 1; modalidades em `20260409_employee_contract_modalidades.sql` (opcional na BD). */
    const payload: Record<string, unknown> = {
      tenant_id: companyId,
      company_id: companyId,
      user_id: newUserId,
      nome,
      email: emailNorm,
      telefone: telemovel || null,
      nif: nifNorm,
      niss: niss || null,
      cargo,
      data_admissao: dataInicio,
      contract_start_date: dataInicio,
      tipo_contrato: tipoContrato,
      vencimento_base: vencimentoBase,
      base_salary: vencimentoBase,
      subsidio_alimentacao: subsidioAlimentacao,
      meal_allowance: subsidioAlimentacao,
      subsidio_alimentacao_tipo: body.subsidioAlimentacaoTipo,
      insurance_value: valorSeguroAcidentes,
      moeda: 'EUR',
      status: 'Ativo',
      created_by: session.user.id,
      trabalha_sabado: trabalhaSabado,
      trabalha_domingo: trabalhaDomingo,
    }

    if (process.env.EMPLOYEES_PERSIST_CONTRACT_MODALIDADES === 'true') {
      payload.contrato_modalidade_teletrabalho =
        typeof body.contratoTeletrabalho === 'boolean' ? body.contratoTeletrabalho : false
      payload.contrato_modalidade_tempo_parcial =
        typeof body.contratoTempoParcial === 'boolean' ? body.contratoTempoParcial : false
      const outra =
        typeof body.contratoModalidadeOutra === 'string' ? body.contratoModalidadeOutra.trim() : ''
      payload.contrato_modalidade_outra = outra || null
    }

    const { data: empRow, error: empError } = await admin
      .from('employees')
      .insert(payload)
      .select('id')
      .single()

    if (empError || !empRow?.id) {
      console.error('[colaboradores/criar] employees insert', empError)
      await admin.from('profiles').delete().eq('id', newUserId)
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        {
          error: empError?.message ?? 'Não foi possível criar o registo do colaborador.',
          detail: empError?.message,
        },
        { status: 500 },
      )
    }

    const message = skipInvite
      ? 'Colaborador criado em modo desenvolvimento (sem email). Guarde a palavra-passe inicial mostrada abaixo — não será repetida. O colaborador pode iniciar sessão e alterar a palavra-passe nas definições.'
      : 'Colaborador criado. Foi enviado um email com um link seguro para o colaborador definir a palavra-passe.'

    return NextResponse.json({
      ok: true,
      employeeId: empRow.id,
      companyId,
      message,
      ...(devInitialPassword ? { devInitialPassword, inviteSkipped: true as const } : {}),
    })
  } catch (e) {
    console.error('[colaboradores/criar]', e)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
