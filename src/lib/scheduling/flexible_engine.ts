import { endOfISOWeek, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type {
  GeneratedSchedule,
  HistoricalWorkBlock,
  ScheduleAssignment,
  ScheduleCollaborator,
  ScheduleRuleViolation,
  SchedulingRule,
  ShiftTemplate,
} from '@/types/scheduling'

const MS_H = 3_600_000

export const DEFAULT_SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'M', label: 'Manhã', startHour: 8, durationHours: 8 },
  { id: 'T', label: 'Tarde', startHour: 16, durationHours: 8 },
  { id: 'N', label: 'Noite', startHour: 0, durationHours: 8 },
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseNum(value: string, fallback: number): number {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function monthMatchesDateKey(year: number, monthIndex0: number, dateKey: string): boolean {
  const [y, m] = dateKey.split('-').map(Number)
  return y === year && m - 1 === monthIndex0
}

function isWeekendDay(d: Date): boolean {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

function isoWeekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
}

/** Turnos (células) em sábado/domingo no mês civil — assignments + histórico + candidato opcional. */
function countWeekendShiftsInMonth(
  employeeId: string,
  year: number,
  monthIndex0: number,
  assignments: ScheduleAssignment[],
  history: HistoricalWorkBlock[],
  extra?: { dateKey: string; day: Date },
): number {
  let n = 0
  for (const a of assignments) {
    if (a.employeeId !== employeeId) continue
    if (!monthMatchesDateKey(year, monthIndex0, a.dateKey)) continue
    const [yy, mm, dd] = a.dateKey.split('-').map(Number)
    const d = new Date(yy, mm - 1, dd)
    if (isWeekendDay(d)) n += 1
  }
  for (const h of history) {
    if (h.employeeId !== employeeId) continue
    const dk = dateKeyFromDate(h.start)
    if (!monthMatchesDateKey(year, monthIndex0, dk)) continue
    if (isWeekendDay(h.start)) n += 1
  }
  if (extra && monthMatchesDateKey(year, monthIndex0, extra.dateKey) && isWeekendDay(extra.day)) {
    n += 1
  }
  return n
}

/** Semanas ISO distintas com pelo menos um turno ao sábado ou domingo nesse mês. */
function weekendIsoWeekKeysInMonth(
  employeeId: string,
  year: number,
  monthIndex0: number,
  assignments: ScheduleAssignment[],
  history: HistoricalWorkBlock[],
  extra?: { dateKey: string; day: Date },
): Set<string> {
  const keys = new Set<string>()
  const addIfWeekend = (d: Date, dk: string) => {
    if (!monthMatchesDateKey(year, monthIndex0, dk)) return
    if (!isWeekendDay(d)) return
    keys.add(isoWeekKey(d))
  }
  for (const a of assignments) {
    if (a.employeeId !== employeeId) continue
    const [yy, mm, dd] = a.dateKey.split('-').map(Number)
    const d = new Date(yy, mm - 1, dd)
    addIfWeekend(d, a.dateKey)
  }
  for (const h of history) {
    if (h.employeeId !== employeeId) continue
    const dk = dateKeyFromDate(h.start)
    addIfWeekend(h.start, dk)
  }
  if (extra) addIfWeekend(extra.day, extra.dateKey)
  return keys
}

export function shiftBounds(day: Date, tpl: ShiftTemplate): { start: Date; end: Date } {
  const start = new Date(day)
  start.setHours(tpl.startHour, tpl.startMinute ?? 0, 0, 0)
  const end = new Date(start.getTime() + tpl.durationHours * MS_H)
  return { start, end }
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / MS_H
}

/** Blocos já agendados + histórico timesheet */
function blocksForEmployee(
  employeeId: string,
  assignments: ScheduleAssignment[],
  templates: Map<string, ShiftTemplate>,
  history: HistoricalWorkBlock[],
): HistoricalWorkBlock[] {
  const out: HistoricalWorkBlock[] = [...history.filter((h) => h.employeeId === employeeId)]

  for (const a of assignments) {
    if (a.employeeId !== employeeId || !a.employeeId) continue
    const tpl = templates.get(a.shiftId)
    if (!tpl) continue
    const [yy, mm, dd] = a.dateKey.split('-').map(Number)
    const day = new Date(yy, mm - 1, dd)
    out.push({
      employeeId,
      ...shiftBounds(day, tpl),
    })
  }
  return out
}

function lastWorkEndBefore(
  blocks: HistoricalWorkBlock[],
  beforeStart: Date,
): Date | null {
  let best: Date | null = null
  for (const b of blocks) {
    if (b.end.getTime() <= beforeStart.getTime()) {
      if (!best || b.end.getTime() > best.getTime()) best = b.end
    }
  }
  return best
}

function workHoursOnDay(
  employeeId: string,
  dateKey: string,
  assignments: ScheduleAssignment[],
  templates: Map<string, ShiftTemplate>,
  history: HistoricalWorkBlock[],
  extra?: { shiftId: string; day: Date },
): number {
  let h = 0
  const [yy, mm, dd] = dateKey.split('-').map(Number)
  const dayStart = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  const dayEnd = new Date(yy, mm - 1, dd, 23, 59, 59, 999)

  const addBlock = (s: Date, e: Date) => {
    const overlapStart = new Date(Math.max(s.getTime(), dayStart.getTime()))
    const overlapEnd = new Date(Math.min(e.getTime(), dayEnd.getTime()))
    if (overlapEnd > overlapStart) {
      h += (overlapEnd.getTime() - overlapStart.getTime()) / MS_H
    }
  }

  for (const b of history) {
    if (b.employeeId !== employeeId) continue
    if (dateKeyFromDate(b.start) === dateKey || dateKeyFromDate(b.end) === dateKey) {
      addBlock(b.start, b.end)
    }
  }

  for (const a of assignments) {
    if (a.employeeId !== employeeId || !a.employeeId) continue
    if (a.dateKey !== dateKey) continue
    const tpl = templates.get(a.shiftId)
    if (!tpl) continue
    const [y, m, d] = a.dateKey.split('-').map(Number)
    const { start, end } = shiftBounds(new Date(y, m - 1, d), tpl)
    addBlock(start, end)
  }

  if (extra) {
    const tpl = templates.get(extra.shiftId)
    if (tpl) {
      const { start, end } = shiftBounds(extra.day, tpl)
      addBlock(start, end)
    }
  }

  return h
}

function workHoursInISOWeek(
  employeeId: string,
  weekStart: Date,
  weekEnd: Date,
  assignments: ScheduleAssignment[],
  templates: Map<string, ShiftTemplate>,
  history: HistoricalWorkBlock[],
  extra?: { shiftId: string; day: Date },
): number {
  let h = 0
  const addBlock = (s: Date, e: Date) => {
    const os = new Date(Math.max(s.getTime(), weekStart.getTime()))
    const oe = new Date(Math.min(e.getTime(), weekEnd.getTime()))
    if (oe > os) h += (oe.getTime() - os.getTime()) / MS_H
  }

  for (const b of history) {
    if (b.employeeId !== employeeId) continue
    addBlock(b.start, b.end)
  }

  for (const a of assignments) {
    if (a.employeeId !== employeeId || !a.employeeId) continue
    const tpl = templates.get(a.shiftId)
    if (!tpl) continue
    const [y, m, d] = a.dateKey.split('-').map(Number)
    const { start, end } = shiftBounds(new Date(y, m - 1, d), tpl)
    addBlock(start, end)
  }

  if (extra) {
    const tpl = templates.get(extra.shiftId)
    if (tpl) {
      const { start, end } = shiftBounds(extra.day, tpl)
      addBlock(start, end)
    }
  }

  return h
}

type ValidatorCtx = {
  rule: SchedulingRule
  collaborator: ScheduleCollaborator
  allCollaborators: ScheduleCollaborator[]
  dateKey: string
  day: Date
  shiftTpl: ShiftTemplate
  assignments: ScheduleAssignment[]
  templates: Map<string, ShiftTemplate>
  history: HistoricalWorkBlock[]
}

const validatorRegistry: Record<
  string,
  (ctx: ValidatorCtx) => ScheduleRuleViolation | null
> = {
  min_interval_between_shifts: (ctx) => {
    const minH = parseNum(ctx.rule.value, 11)
    const { start } = shiftBounds(ctx.day, ctx.shiftTpl)
    const blocks = blocksForEmployee(
      ctx.collaborator.id,
      ctx.assignments,
      ctx.templates,
      ctx.history,
    )
    const lastEnd = lastWorkEndBefore(blocks, start)
    if (!lastEnd) return null
    const gap = hoursBetween(lastEnd, start)
    if (gap < minH) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Intervalo ${gap.toFixed(1)}h < mínimo ${minH}h`,
      }
    }
    return null
  },

  max_hours_per_day: (ctx) => {
    const maxH = parseNum(ctx.rule.value, 8)
    const { start, end } = shiftBounds(ctx.day, ctx.shiftTpl)
    const extraHours = (end.getTime() - start.getTime()) / MS_H
    const already = workHoursOnDay(
      ctx.collaborator.id,
      ctx.dateKey,
      ctx.assignments,
      ctx.templates,
      ctx.history,
    )
    if (already + extraHours > maxH + 1e-6) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Horas no dia excedem ${maxH}h (com este turno: ${(already + extraHours).toFixed(1)}h)`,
      }
    }
    return null
  },

  weekly_rest_hours: (ctx) => {
    const minRest = parseNum(ctx.rule.value, 35)
    const { start } = shiftBounds(ctx.day, ctx.shiftTpl)
    const weekStart = startOfISOWeek(start)
    const weekEnd = endOfISOWeek(start)
    const work = workHoursInISOWeek(
      ctx.collaborator.id,
      weekStart,
      weekEnd,
      ctx.assignments,
      ctx.templates,
      ctx.history,
      { shiftId: ctx.shiftTpl.id, day: ctx.day },
    )
    const rest = 168 - work
    if (rest < minRest - 1e-6) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Descanso semanal estimado ${rest.toFixed(1)}h < ${minRest}h`,
      }
    }
    return null
  },

  equity_shift_spread: (ctx) => {
    const maxSpread = parseNum(ctx.rule.value, 2)
    const counts = new Map<string, number>()
    for (const c of ctx.allCollaborators) counts.set(c.id, 0)
    for (const a of ctx.assignments) {
      if (!a.employeeId) continue
      counts.set(a.employeeId, (counts.get(a.employeeId) ?? 0) + 1)
    }
    counts.set(
      ctx.collaborator.id,
      (counts.get(ctx.collaborator.id) ?? 0) + 1,
    )
    const vals = [...counts.values()]
    if (vals.length < 2) return null
    const spread = Math.max(...vals) - Math.min(...vals)
    if (spread > maxSpread + 1e-6) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Desequilíbrio de turnos (spread ${spread} > ${maxSpread})`,
      }
    }
    return null
  },

  max_weekend_shifts_per_month: (ctx) => {
    if (!isWeekendDay(ctx.day)) return null
    const maxN = Math.max(0, Math.floor(parseNum(ctx.rule.value, 999)))
    const y = ctx.day.getFullYear()
    const m = ctx.day.getMonth()
    const n = countWeekendShiftsInMonth(
      ctx.collaborator.id,
      y,
      m,
      ctx.assignments,
      ctx.history,
      { dateKey: ctx.dateKey, day: ctx.day },
    )
    if (n > maxN) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Com este turno ficam ${n} turnos ao fim de semana (sáb/dom) neste mês; o máximo definido é ${maxN}.`,
      }
    }
    return null
  },

  max_weekend_weeks_per_month: (ctx) => {
    if (!isWeekendDay(ctx.day)) return null
    const maxW = Math.max(0, Math.floor(parseNum(ctx.rule.value, 999)))
    const y = ctx.day.getFullYear()
    const m = ctx.day.getMonth()
    const keys = weekendIsoWeekKeysInMonth(
      ctx.collaborator.id,
      y,
      m,
      ctx.assignments,
      ctx.history,
      { dateKey: ctx.dateKey, day: ctx.day },
    )
    if (keys.size > maxW) {
      return {
        ruleId: ctx.rule.id,
        ruleLabel: ctx.rule.label,
        constraintId: ctx.rule.constraintId,
        priority: ctx.rule.priority,
        message: `Com este turno ficam ${keys.size} semana(s) distintas com trabalho ao fim de semana no mês; o máximo é ${maxW}.`,
      }
    }
    return null
  },
}

function runValidatorsForRule(ctx: ValidatorCtx): ScheduleRuleViolation | null {
  const fn = validatorRegistry[ctx.rule.constraintId]
  if (!fn) return null
  return fn(ctx)
}

/** Disponibilidade ao fim de semana por colaborador (RH). */
export function collaboratorAvailableOnWeekendDay(collaborator: ScheduleCollaborator, day: Date): boolean {
  const dow = day.getDay()
  if (dow === 6 && collaborator.worksSaturday === false) return false
  if (dow === 0 && collaborator.worksSunday === false) return false
  return true
}

export function validateAssignmentCandidate(
  collaborator: ScheduleCollaborator,
  dateKey: string,
  day: Date,
  shiftTpl: ShiftTemplate,
  rules: SchedulingRule[],
  assignments: ScheduleAssignment[],
  templates: Map<string, ShiftTemplate>,
  history: HistoricalWorkBlock[],
  allCollaborators: ScheduleCollaborator[],
): ScheduleRuleViolation[] {
  const violations: ScheduleRuleViolation[] = []

  if (!collaboratorAvailableOnWeekendDay(collaborator, day)) {
    const dow = day.getDay()
    violations.push({
      ruleId: 'weekend_rh',
      ruleLabel: 'Disponibilidade ao fim de semana',
      constraintId: 'weekend_availability',
      priority: 1,
      message:
        dow === 6
          ? 'Colaborador não disponível aos sábados (definição da ficha RH).'
          : 'Colaborador não disponível aos domingos (definição da ficha RH).',
    })
  }

  for (const rule of rules) {
    const v = runValidatorsForRule({
      rule,
      collaborator,
      allCollaborators,
      dateKey,
      day,
      shiftTpl,
      assignments,
      templates,
      history,
    })
    if (v) violations.push(v)
  }
  return violations
}

/** Recalcula violações para todas as células (útil após drag & drop). */
export function revalidateSchedule(
  assignments: ScheduleAssignment[],
  rules: SchedulingRule[],
  collaborators: ScheduleCollaborator[],
  shiftTemplates: ShiftTemplate[],
  history: HistoricalWorkBlock[],
): ScheduleAssignment[] {
  const templates = new Map(shiftTemplates.map((t) => [t.id, t]))
  const collabMap = new Map(collaborators.map((c) => [c.id, c]))

  return assignments.map((a) => {
    if (!a.employeeId) {
      return { ...a, violations: a.emptyAlert ? a.violations : [] }
    }
    const c = collabMap.get(a.employeeId)
    if (!c) {
      return { ...a, violations: [] }
    }
    const [y, m, d] = a.dateKey.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    const tpl = templates.get(a.shiftId)
    if (!tpl) return { ...a, violations: [] }

    const others = assignments.filter((x) => x.id !== a.id)
    const violations = validateAssignmentCandidate(
      c,
      a.dateKey,
      day,
      tpl,
      rules,
      others,
      templates,
      history,
      collaborators,
    )
    return { ...a, violations }
  })
}

export interface GenerateFlexibleScheduleInput {
  colaboradores: ScheduleCollaborator[]
  mes_referencia: string
  regras_ativas: SchedulingRule[]
  shiftTemplates?: ShiftTemplate[]
  historico_blocos?: HistoricalWorkBlock[]
}

export function generateFlexibleSchedule(input: GenerateFlexibleScheduleInput): GeneratedSchedule {
  const warnings: string[] = []
  const { colaboradores, mes_referencia, regras_ativas } = input
  const shiftTemplates = input.shiftTemplates ?? DEFAULT_SHIFT_TEMPLATES
  const history = input.historico_blocos ?? []
  const templates = new Map(shiftTemplates.map((t) => [t.id, t]))

  const parts = mes_referencia.split('-').map(Number)
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    return { mesReferencia: mes_referencia, assignments: [], warnings: ['mes_referencia inválido'] }
  }

  const [y, m] = parts
  const lastDay = new Date(y, m, 0).getDate()
  const dates: Date[] = []
  for (let d = 1; d <= lastDay; d++) {
    dates.push(new Date(y, m - 1, d))
  }

  if (colaboradores.length === 0) {
    warnings.push('Sem colaboradores — escala vazia.')
  }

  const assignments: ScheduleAssignment[] = []
  const activeRules = regras_ativas.filter((r) => validatorRegistry[r.constraintId])

  for (const day of dates) {
    const dateKey = dateKeyFromDate(day)
    for (const tpl of shiftTemplates) {
      const assignmentId = `${dateKey}__${tpl.id}`
      let best: { emp: ScheduleCollaborator; soft: ScheduleRuleViolation[] } | null = null

      const candidates = [...colaboradores].sort((a, b) => {
        const ca = assignments.filter((x) => x.employeeId === a.id).length
        const cb = assignments.filter((x) => x.employeeId === b.id).length
        return ca - cb
      })

      for (const emp of candidates) {
        if (!collaboratorAvailableOnWeekendDay(emp, day)) continue

        const violations = validateAssignmentCandidate(
          emp,
          dateKey,
          day,
          tpl,
          activeRules,
          assignments,
          templates,
          history,
          colaboradores,
        )
        const hard = violations.filter((v) => v.priority === 1)
        if (hard.length > 0) continue
        const soft = violations.filter((v) => v.priority === 2)
        if (!best || soft.length < best.soft.length) {
          best = { emp, soft }
        }
      }

      if (best) {
        assignments.push({
          id: assignmentId,
          dateKey,
          shiftId: tpl.id,
          employeeId: best.emp.id,
          violations: best.soft,
          emptyAlert: false,
        })
      } else {
        assignments.push({
          id: assignmentId,
          dateKey,
          shiftId: tpl.id,
          employeeId: null,
          violations: [],
          emptyAlert: true,
        })
        warnings.push(`Sem colaborador válido para ${dateKey} turno ${tpl.label} (regras obrigatórias).`)
      }
    }
  }

  const revalidated = revalidateSchedule(
    assignments,
    activeRules,
    colaboradores,
    shiftTemplates,
    history,
  )

  return {
    mesReferencia: mes_referencia,
    assignments: revalidated,
    warnings,
  }
}

