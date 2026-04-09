'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type View,
} from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { AlertTriangle, CalendarDays, Plus, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@/utils/supabase-browser'
import {
  DEFAULT_SHIFT_TEMPLATES,
  dateKeyFromDate,
  generateFlexibleSchedule,
  revalidateSchedule,
  shiftBounds,
} from '@/lib/scheduling/flexible_engine'
import { fetchTimesheetHistoryForSchedule } from '@/lib/scheduling/timesheet_history'
import type {
  HistoricalWorkBlock,
  ScheduleAssignment,
  ScheduleCollaborator,
  ScheduleRuleViolation,
  SchedulingRule,
} from '@/types/scheduling'
import {
  SCHEDULING_RULE_TEMPLATES,
  type SchedulingConstraintId,
  type SchedulingRulePriority,
} from '@/types/scheduling'

const locales = { pt }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop<ScheduleCalendarEvent>(Calendar)

export interface CalendarEventResource {
  assignmentId: string
  violations: ScheduleRuleViolation[]
  emptyAlert?: boolean
}

export type ScheduleCalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resource: CalendarEventResource
}

export interface ScheduleModuleProps {
  companyId?: string
  colaboradores: ScheduleCollaborator[]
  mesReferenciaInitial?: string
}

function firstOfMonthFromYyyymm(s?: string): Date {
  const raw = s ?? format(new Date(), 'yyyy-MM')
  const [y, m] = raw.split('-').map(Number)
  if (Number.isFinite(y) && Number.isFinite(m)) return new Date(y, m - 1, 1)
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function nearestShiftTemplate(start: Date) {
  const h = start.getHours() + start.getMinutes() / 60
  let best = DEFAULT_SHIFT_TEMPLATES[0]
  let bestD = Infinity
  for (const t of DEFAULT_SHIFT_TEMPLATES) {
    const d = Math.abs(t.startHour - h)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

function assignmentsToEvents(
  assignments: ScheduleAssignment[],
  collabMap: Map<string, ScheduleCollaborator>,
): ScheduleCalendarEvent[] {
  return assignments.map((a) => {
    const [y, m, d] = a.dateKey.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    const tpl =
      DEFAULT_SHIFT_TEMPLATES.find((s) => s.id === a.shiftId) ?? DEFAULT_SHIFT_TEMPLATES[0]
    const { start, end } = shiftBounds(day, tpl)
    const name = a.employeeId ? collabMap.get(a.employeeId)?.nome ?? '?' : 'Vazio / alerta'
    const alert = a.emptyAlert ? ' ⚠' : ''
    return {
      id: a.id,
      title: `${tpl.label}: ${name}${alert}`,
      start,
      end,
      resource: {
        assignmentId: a.id,
        violations: a.violations,
        emptyAlert: a.emptyAlert,
      },
    }
  })
}

function ScheduleEvent({ event }: EventProps<ScheduleCalendarEvent>) {
  const v = event.resource?.violations
  const tip =
    v?.map((x) => `${x.ruleLabel}: ${x.message}`).join(' · ') ?? ''
  return (
    <div className="flex items-start gap-1 text-xs leading-tight" title={tip || undefined}>
      {v?.length ? <span aria-hidden>⚠️</span> : null}
      <span className="font-medium">{event.title}</span>
    </div>
  )
}

export default function ScheduleModule({
  companyId,
  colaboradores,
  mesReferenciaInitial,
}: ScheduleModuleProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [calendarDate, setCalendarDate] = useState(() =>
    firstOfMonthFromYyyymm(mesReferenciaInitial),
  )
  const mesReferencia = format(calendarDate, 'yyyy-MM')
  const [regras, setRegras] = useState<SchedulingRule[]>([])
  const [templateKey, setTemplateKey] = useState<SchedulingConstraintId>(
    SCHEDULING_RULE_TEMPLATES[0].constraintId,
  )
  const [novaPrioridade, setNovaPrioridade] = useState<SchedulingRulePriority>(1)
  const [novoValor, setNovoValor] = useState(SCHEDULING_RULE_TEMPLATES[0].defaultValue)
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [history, setHistory] = useState<HistoricalWorkBlock[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [view, setView] = useState<View>('month')

  const collabMap = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  )

  const events = useMemo(
    () => assignmentsToEvents(assignments, collabMap),
    [assignments, collabMap],
  )

  useEffect(() => {
    let cancelled = false
    const mesRef = format(calendarDate, 'yyyy-MM')
    void (async () => {
      if (!supabase || !companyId || colaboradores.length === 0) {
        if (!cancelled) {
          setHistory([])
          setHistoryError(null)
        }
        return
      }
      const { blocks, error } = await fetchTimesheetHistoryForSchedule(supabase, {
        companyId,
        employeeIds: colaboradores.map((c) => c.id),
        mesReferencia: mesRef,
      })
      if (!cancelled) {
        setHistory(blocks)
        setHistoryError(error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, companyId, colaboradores, calendarDate])

  const addRule = () => {
    const tpl = SCHEDULING_RULE_TEMPLATES.find((t) => t.constraintId === templateKey)
    if (!tpl) return
    const rule: SchedulingRule = {
      id: crypto.randomUUID(),
      label: tpl.label,
      type: tpl.type,
      value: novoValor,
      priority: novaPrioridade,
      constraintId: tpl.constraintId,
    }
    setRegras((r) => [...r, rule])
  }

  const removeRule = (id: string) => setRegras((r) => r.filter((x) => x.id !== id))

  const runGenerate = () => {
    const gen = generateFlexibleSchedule({
      colaboradores,
      mes_referencia: mesReferencia,
      regras_ativas: regras,
      historico_blocos: history,
    })
    setAssignments(gen.assignments)
    if (gen.warnings.length && typeof window !== 'undefined') {
      console.info('Motor de escalas:', gen.warnings)
    }
  }

  const onEventDrop = useCallback(
    (args: { event: ScheduleCalendarEvent; start: Date }) => {
      const { event, start } = args
      const tpl = nearestShiftTemplate(start)
      const newKey = dateKeyFromDate(start)
      const newId = `${newKey}__${tpl.id}`

      setAssignments((prev) => {
        const moved = prev.find((a) => a.id === event.id)
        if (!moved) return prev

        const oldIdForSlot = `${moved.dateKey}__${moved.shiftId}`
        const occupied = prev.find(
          (a) => a.dateKey === newKey && a.shiftId === tpl.id && a.id !== moved.id,
        )

        let next: ScheduleAssignment[]
        if (occupied) {
          const rest = prev.filter((a) => a.id !== moved.id && a.id !== occupied.id)
          next = [
            ...rest,
            {
              ...moved,
              id: newId,
              dateKey: newKey,
              shiftId: tpl.id,
              violations: [],
              emptyAlert: !moved.employeeId,
            },
            {
              ...occupied,
              id: oldIdForSlot,
              dateKey: moved.dateKey,
              shiftId: moved.shiftId,
              violations: [],
              emptyAlert: !occupied.employeeId,
            },
          ]
        } else {
          next = [
            ...prev.filter((a) => a.id !== moved.id),
            {
              ...moved,
              id: newId,
              dateKey: newKey,
              shiftId: tpl.id,
              violations: [],
              emptyAlert: !moved.employeeId,
            },
          ]
        }

        return revalidateSchedule(
          next,
          regras,
          colaboradores,
          DEFAULT_SHIFT_TEMPLATES,
          history,
        )
      })
    },
    [regras, colaboradores, history],
  )

  const selectedTpl = SCHEDULING_RULE_TEMPLATES.find((t) => t.constraintId === templateKey)

  return (
    <div className="space-y-6 font-brand-secondary">
      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="rounded-lg border border-brand-border bg-white p-5 shadow-brand">
            <h2 className="mb-4 flex items-center gap-2 font-brand-primary text-lg font-semibold text-brand-midnight">
              <CalendarDays className="h-5 w-5 text-brand-primary" />
              Regras dinâmicas
            </h2>
            <p className="mb-4 rounded-lg bg-brand-light/60 px-3 py-2 text-xs leading-relaxed text-brand-slate">
              Como <strong>gestor</strong>, escolhe o tipo de regra, o valor numérico e a prioridade, e carrega em{' '}
              <strong>Adicionar regra</strong>. Podes <strong>empilhar várias regras</strong> (ex.: descanso mínimo +
              no máximo <strong>1 fim de semana por mês</strong> por pessoa). Regras <em>Obrigatórias</em> bloqueiam
              turnos inviáveis; <em>Preferenciais</em> geram aviso mas permitem gerar a escala. O motor também usa a
              disponibilidade ao sábado/domingo definida na ficha de cada colaborador.
            </p>

            <label className="mb-2 block text-xs font-medium uppercase text-brand-slate">
              Mês de referência
            </label>
            <input
              type="month"
              value={mesReferencia}
              onChange={(e) => {
                const v = e.target.value
                const [y, m] = v.split('-').map(Number)
                if (Number.isFinite(y) && Number.isFinite(m)) {
                  setCalendarDate(new Date(y, m - 1, 1))
                }
              }}
              className="mb-4 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-xs font-medium uppercase text-brand-slate">
              Adicionar regra
            </label>
            <select
              value={templateKey}
              onChange={(e) => {
                setTemplateKey(e.target.value as SchedulingConstraintId)
                const t = SCHEDULING_RULE_TEMPLATES.find((x) => x.constraintId === e.target.value)
                if (t) setNovoValor(t.defaultValue)
              }}
              className="mb-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
            >
              {SCHEDULING_RULE_TEMPLATES.map((t) => (
                <option key={t.constraintId} value={t.constraintId}>
                  {t.label}
                </option>
              ))}
            </select>

            {selectedTpl ? (
              <p className="mb-2 text-xs text-brand-slate">{selectedTpl.valueHint}</p>
            ) : null}

            <label className="mb-1 block text-xs font-medium uppercase text-brand-slate">
              Valor
            </label>
            <input
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              className="mb-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-xs font-medium uppercase text-brand-slate">
              Prioridade
            </label>
            <select
              value={novaPrioridade}
              onChange={(e) => setNovaPrioridade(Number(e.target.value) as SchedulingRulePriority)}
              className="mb-4 w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
            >
              <option value={1}>Obrigatório</option>
              <option value={2}>Preferencial</option>
            </select>

            <button
              type="button"
              onClick={addRule}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-midnight py-2.5 text-sm font-medium text-white hover:bg-brand-midnight/90"
            >
              <Plus className="h-4 w-4" />
              Adicionar regra
            </button>

            <ul className="space-y-2">
              {regras.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-brand-border bg-brand-light/50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-brand-midnight">{r.label}</p>
                    <p className="text-xs text-brand-slate">
                      {r.type} · valor {r.value} ·{' '}
                      {r.priority === 1 ? 'Obrigatório' : 'Preferencial'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRule(r.id)}
                    className="text-brand-slate hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            {regras.length === 0 ? (
              <p className="mt-3 text-xs text-brand-slate">Nenhuma regra — o motor usa lista vazia.</p>
            ) : null}

            <button
              type="button"
              onClick={runGenerate}
              className="mt-6 w-full rounded-lg border-2 border-brand-primary bg-white py-3 text-sm font-semibold text-brand-midnight hover:bg-cyan-50"
            >
              Gerar escala com estas regras
            </button>

            {historyError ? (
              <p className="mt-3 flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Timesheets: {historyError}
              </p>
            ) : (
              <p className="mt-3 text-xs text-brand-slate">
                Histórico: {history.length} bloco(s) inferido(s) de timesheets (mês anterior + mês
                atual).
              </p>
            )}
          </div>
        </aside>

        <section className="lg:col-span-8">
          <div className="min-h-[560px] rounded-lg border border-brand-border bg-white p-3 shadow-brand md:p-4">
            <DnDCalendar
              localizer={localizer}
              culture="pt"
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 520 }}
              view={view}
              onView={setView}
              date={calendarDate}
              onNavigate={setCalendarDate}
              views={['month', 'week', 'day']}
              defaultDate={calendarDate}
              draggableAccessor={() => true}
              onEventDrop={(args) => {
                const start =
                  args.start instanceof Date ? args.start : new Date(args.start)
                onEventDrop({ event: args.event, start })
              }}
              components={{
                event: ScheduleEvent,
              }}
              messages={{
                today: 'Hoje',
                previous: 'Anterior',
                next: 'Seguinte',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                agenda: 'Agenda',
                date: 'Data',
                time: 'Hora',
                event: 'Turno',
                showMore: (n: number) => `+${n} mais`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-brand-slate">
            Arraste um turno para outro dia; ⚠️ indica violação de regra configurada. Turnos vazios
            surgem quando nenhuma combinação satisfaz regras obrigatórias.
          </p>
        </section>
      </div>
    </div>
  )
}
