/**
 * Sprint 3 — Motor de escalas flexível: tipos de regras e agendamento.
 */

/** Categoria semântica para agrupar validadores no motor */
export type SchedulingRuleType = 'restrição_tempo' | 'descanso' | 'equidade'

/** 1 = Obrigatório, 2 = Desejável / preferencial */
export type SchedulingRulePriority = 1 | 2

/**
 * Identificador de preset (droplist) — mapeia para validadores concretos.
 * Mantém type alinhado ao que o gestor vê na UI.
 */
export type SchedulingConstraintId =
  | 'min_interval_between_shifts'
  | 'weekly_rest_hours'
  | 'max_hours_per_day'
  | 'equity_shift_spread'
  /** Regra implícita por colaborador (fins de semana); não aparece na lista de regras configuráveis */
  | 'weekend_availability'
  /** Máx. turnos (células) em sábado ou domingo no mesmo mês civil — por colaborador */
  | 'max_weekend_shifts_per_month'
  /** Máx. semanas ISO distintas com pelo menos um turno ao sábado ou domingo no mês — ex.: 1 = um “fim de semana” por mês */
  | 'max_weekend_weeks_per_month'

/** Regra configurada pelo gestor (persistível em BD futura) */
export interface SchedulingRule {
  id: string
  label: string
  type: SchedulingRuleType
  /** Valor textual (horas, limite, etc.) — interpretado pelo validador do constraintId */
  value: string
  priority: SchedulingRulePriority
  constraintId: SchedulingConstraintId
}

export interface SchedulingRuleTemplate {
  constraintId: SchedulingConstraintId
  label: string
  type: SchedulingRuleType
  defaultValue: string
  valueHint: string
}

export const SCHEDULING_RULE_TEMPLATES: SchedulingRuleTemplate[] = [
  {
    constraintId: 'min_interval_between_shifts',
    label: 'Intervalo mínimo entre turnos',
    type: 'descanso',
    defaultValue: '11',
    valueHint: 'Horas (ex.: 11 entre fim e início)',
  },
  {
    constraintId: 'weekly_rest_hours',
    label: 'Descanso semanal mínimo',
    type: 'descanso',
    defaultValue: '35',
    valueHint: 'Horas de descanso mínimas na semana ISO (168h − trabalho)',
  },
  {
    constraintId: 'max_hours_per_day',
    label: 'Horas máximas por dia',
    type: 'restrição_tempo',
    defaultValue: '8',
    valueHint: 'Máx. horas de trabalho no mesmo dia civil',
  },
  {
    constraintId: 'equity_shift_spread',
    label: 'Equidade de turnos',
    type: 'equidade',
    defaultValue: '2',
    valueHint: 'Diferença máxima de turnos entre colaboradores',
  },
  {
    constraintId: 'max_weekend_shifts_per_month',
    label: 'Máx. turnos ao fim de semana por mês',
    type: 'restrição_tempo',
    defaultValue: '2',
    valueHint:
      'Número máximo de turnos (sábado ou domingo) por colaborador no mês do calendário. Ex.: 1 = só um turno em fds.',
  },
  {
    constraintId: 'max_weekend_weeks_per_month',
    label: 'Máx. fins de semana (semanas) por mês',
    type: 'restrição_tempo',
    defaultValue: '1',
    valueHint:
      'Quantas semanas ISO distintas podem ter trabalho ao sábado ou domingo, por colaborador, nesse mês. Ex.: 1 = apenas um fim de semana por mês.',
  },
]

export interface ScheduleCollaborator {
  id: string
  nome: string
  /** Se false, não escalar ao sábado; undefined/null tratado como disponível */
  worksSaturday?: boolean | null
  /** Se false, não escalar ao domingo; undefined/null tratado como disponível */
  worksSunday?: boolean | null
}

/** Definição de um turno recorrente (hora local no dia) */
export interface ShiftTemplate {
  id: string
  label: string
  /** Hora de início 0–23 */
  startHour: number
  startMinute?: number
  durationHours: number
}

/** Bloco de trabalho real ou inferido (ex.: timesheets) */
export interface HistoricalWorkBlock {
  employeeId: string
  start: Date
  end: Date
}

export interface ScheduleAssignment {
  id: string
  dateKey: string
  shiftId: string
  employeeId: string | null
  /** Sem colaborador válido após esgotar combinações (regras P1) */
  emptyAlert?: boolean
  /** Violações após geração ou edição manual */
  violations: ScheduleRuleViolation[]
}

export interface ScheduleRuleViolation {
  ruleId: string
  ruleLabel: string
  constraintId: SchedulingConstraintId
  priority: SchedulingRulePriority
  message: string
}

export interface GeneratedSchedule {
  mesReferencia: string
  assignments: ScheduleAssignment[]
  /** Avisos globais do motor */
  warnings: string[]
}
