import type { SupabaseClient } from '@supabase/supabase-js'
import type { HistoricalWorkBlock } from '@/types/scheduling'

export interface TimesheetRow {
  employee_id: string
  entry_timestamp: string
  entry_type?: string | null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Chave dia civil local YYYY-MM-DD */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Infere blocos [min_ts, max_ts] por colaborador e dia civil local.
 * Compatível com timesheets (entrada/saída ou apenas sequência temporal).
 */
export function inferWorkBlocksFromTimesheetRows(rows: TimesheetRow[]): HistoricalWorkBlock[] {
  const groups = new Map<string, TimesheetRow[]>()
  for (const r of rows) {
    const t = new Date(r.entry_timestamp)
    if (Number.isNaN(t.getTime())) continue
    const key = `${r.employee_id}|${localDateKey(t)}`
    const arr = groups.get(key)
    if (arr) arr.push(r)
    else groups.set(key, [r])
  }

  const blocks: HistoricalWorkBlock[] = []
  for (const [, dayRows] of groups) {
    dayRows.sort(
      (a, b) => new Date(a.entry_timestamp).getTime() - new Date(b.entry_timestamp).getTime(),
    )
    if (dayRows.length === 0) continue
    const start = new Date(dayRows[0].entry_timestamp)
    const end = new Date(dayRows[dayRows.length - 1].entry_timestamp)
    const employeeId = dayRows[0].employee_id
    if (end.getTime() - start.getTime() < 60_000) continue
    blocks.push({ employeeId, start, end })
  }
  return blocks
}

/**
 * Lê `timesheets` desde o 1.º dia do mês anterior ao fim do mês de referência,
 * para cobrir descanso entre último dia do mês anterior e o 1.º dia do novo mês.
 */
export async function fetchTimesheetHistoryForSchedule(
  supabase: SupabaseClient,
  params: {
    companyId: string
    employeeIds: string[]
    mesReferencia: string
  },
): Promise<{ blocks: HistoricalWorkBlock[]; error: string | null }> {
  const { companyId, employeeIds, mesReferencia } = params
  const parts = mesReferencia.split('-').map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    return { blocks: [], error: 'mes_referencia inválido (use YYYY-MM).' }
  }
  const [y, m] = parts
  const refStart = new Date(y, m - 1, 1)
  const loadStart = new Date(refStart)
  loadStart.setMonth(loadStart.getMonth() - 1)
  loadStart.setDate(1)
  loadStart.setHours(0, 0, 0, 0)
  const refEnd = new Date(y, m, 0, 23, 59, 59, 999)

  if (employeeIds.length === 0) {
    return { blocks: [], error: null }
  }

  const { data, error } = await supabase
    .from('timesheets')
    .select('employee_id, entry_timestamp, entry_type')
    .eq('company_id', companyId)
    .in('employee_id', employeeIds)
    .gte('entry_timestamp', loadStart.toISOString())
    .lte('entry_timestamp', refEnd.toISOString())
    .order('entry_timestamp', { ascending: true })

  if (error) {
    return { blocks: [], error: error.message }
  }

  const rows = (data ?? []) as TimesheetRow[]
  return { blocks: inferWorkBlocksFromTimesheetRows(rows), error: null }
}
