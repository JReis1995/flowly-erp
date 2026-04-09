/**
 * Flowly ERP — Motor financeiro / payroll PT (indicativo)
 * Edge Function: calculate_employee_costs
 *
 * Espelho da lógica em `src/lib/rh/calculate-employee-costs-engine.ts` (Next.js).
 * Ao alterar fórmulas, mantenha os dois alinhados ou faça deploy só da Edge Function.
 *
 * Aviso legal: valores de indemnização, TSU e subsídios dependem de regime contratual,
 * convenção coletiva e atualizações legais. Este motor produz estimativas para provisões internas.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Decimal from "npm:decimal.js@10.5.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const TSU_EMPLOYER_RATE = new Decimal("0.2375");
const TSU_EMPLOYEE_RATE = new Decimal("0.11");
/** Dias de indemnização por ano completo (modelo simplificado pós-reforma geral) */
const INDEMNITY_DAYS_PER_YEAR = new Decimal("18");
/** Tecto global em dias (referência comum em simulações; validar juridicamente) */
const INDEMNITY_DAYS_CAP = new Decimal("240");
/** Tecto em meses de retribuição base (alternativa ao tecto em dias) */
const INDEMNITY_MONTHS_CAP = new Decimal("12");
/** Dias úteis de férias anuais (referência típica) */
const ANNUAL_VACATION_WORKING_DAYS = new Decimal("22");
/** Dias do mês para taxa diária (prática frequente em CT) */
const MONTH_CALENDAR_DAYS = new Decimal("30");
const DEFAULT_MEDICAL_PROVISION = new Decimal("50");
const MS_PER_DAY = 86_400_000;

type JsonPrimitive = string | number | boolean | null;

interface CalcInput {
  base_salary: number;
  bonuses?: number;
  meal_allowance?: number;
  insurance_value?: number;
  contract_start_date: string;
  reference_date?: string;
  unused_vacation_days?: number;
  medical_exam_annual_cost?: number;
  /** Se true, inclui subsídio refeição na base sujeita a TSU (conservador; em PT há isenção até limite legal) */
  include_meal_in_tsu?: boolean;
}

function jsonResponse(body: Record<string, JsonPrimitive | unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toDecimal(
  value: unknown,
  field: string,
  warnings: string[],
): Decimal {
  if (value === undefined || value === null || value === "") {
    return new Decimal(0);
  }
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n)) {
    warnings.push(`Valor numérico inválido em "${field}" — tratado como 0.`);
    return new Decimal(0);
  }
  if (n < 0) {
    warnings.push(`"${field}" negativo — truncado a 0.`);
    return new Decimal(0);
  }
  return new Decimal(n);
}

function parseISODate(value: string, field: string, warnings: string[]): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    warnings.push(`Data inválida: ${field}.`);
    return null;
  }
  return d;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthsBetweenInclusive(start: Date, end: Date): Decimal {
  const s = startOfDayUTC(start);
  const e = startOfDayUTC(end);
  if (e < s) return new Decimal(0);
  const months =
    (e.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    (e.getUTCMonth() - s.getUTCMonth()) +
    1;
  return Decimal.max(0, new Decimal(months));
}

/** Anos de serviço como fração baseada em dias / 365.25 */
function tenureYearsDecimal(start: Date, end: Date, warnings: string[]): Decimal {
  const s = startOfDayUTC(start).getTime();
  const e = startOfDayUTC(end).getTime();
  if (e < s) {
    warnings.push("Data de referência anterior ao início do contrato — antiguidade considerada 0.");
    return new Decimal(0);
  }
  const days = new Decimal(e - s).div(MS_PER_DAY);
  return days.div("365.25");
}

function roundMoney(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function calcTsu(
  base: Decimal,
  bonuses: Decimal,
  meal: Decimal,
  includeMeal: boolean,
  warnings: string[],
) {
  const incidence = includeMeal
    ? base.plus(bonuses).plus(meal)
    : base.plus(bonuses);
  if (incidence.isZero() && (!base.isZero() || !bonuses.isZero() || !meal.isZero())) {
    warnings.push("Base de incidência TSU nula após normalização.");
  }
  const employer = roundMoney(incidence.times(TSU_EMPLOYER_RATE));
  const employee = roundMoney(incidence.times(TSU_EMPLOYEE_RATE));
  return {
    incidenceBase: roundMoney(incidence),
    employerAmount: employer,
    employeeAmount: employee,
    totalCharge: employer.plus(employee),
  };
}

/** Proporcional linear por meses civis entre início e referência (subsídios de férias e Natal). */
function calcSubsidiesProportional(
  referenceMonthly: Decimal,
  contractStart: Date,
  reference: Date,
  warnings: string[],
) {
  const yearStart = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
  const periodStart = contractStart > yearStart ? contractStart : yearStart;
  const monthsInYear = monthsBetweenInclusive(periodStart, reference);
  const denom = new Decimal(12);
  const fraction = Decimal.min(new Decimal(1), monthsInYear.div(denom));
  const ferias = roundMoney(referenceMonthly.times(fraction));
  const natal = roundMoney(referenceMonthly.times(fraction));
  if (monthsInYear.isZero()) {
    warnings.push("Sem meses completos no período — subsídios proporcionais = 0.");
  }
  return { feriasProportional: ferias, natalProportional: natal, monthsCounted: monthsInYear, fraction };
}

function calcIndemnitySafeguard(
  monthlyBase: Decimal,
  contractStart: Date,
  reference: Date,
  warnings: string[],
) {
  const daily = monthlyBase.div(MONTH_CALENDAR_DAYS);
  if (daily.isZero()) {
    warnings.push("Retribuição base zero — salvaguarda de indemnização = 0.");
    return {
      tenureYears: new Decimal(0),
      rawIndemnityDays: new Decimal(0),
      cappedIndemnityDays: new Decimal(0),
      indemnityValue: new Decimal(0),
      valueCapByMonths: new Decimal(0),
      capApplied: "none" as const,
    };
  }
  const tenureYears = tenureYearsDecimal(contractStart, reference, warnings);
  const rawDays = tenureYears.times(INDEMNITY_DAYS_PER_YEAR);
  const cappedByDays = Decimal.min(rawDays, INDEMNITY_DAYS_CAP);
  const indemnityByDays = roundMoney(cappedByDays.times(daily));
  const valueCapByMonths = roundMoney(monthlyBase.times(INDEMNITY_MONTHS_CAP));
  let indemnityValue = Decimal.min(indemnityByDays, valueCapByMonths);
  let capApplied: "days240" | "months12" | "none" = "none";
  if (indemnityValue.eq(indemnityByDays) && rawDays.gt(INDEMNITY_DAYS_CAP)) {
    capApplied = "days240";
  }
  if (indemnityValue.eq(valueCapByMonths) && indemnityByDays.gt(valueCapByMonths)) {
    capApplied = "months12";
  }
  return {
    tenureYears,
    rawIndemnityDays: roundMoney(rawDays),
    cappedIndemnityDays: roundMoney(cappedByDays),
    indemnityValue,
    valueCapByMonths,
    capApplied,
  };
}

function calcVacationProvision(
  baseSalary: Decimal,
  contractStart: Date,
  reference: Date,
  unusedDaysInput: number | undefined,
  warnings: string[],
) {
  const dailyVacation = baseSalary.div(ANNUAL_VACATION_WORKING_DAYS);
  if (dailyVacation.isZero()) {
    return { unusedDays: new Decimal(0), provision: new Decimal(0), assumed: false };
  }
  let unusedDays: Decimal;
  let assumed = false;
  if (unusedDaysInput !== undefined && Number.isFinite(unusedDaysInput) && unusedDaysInput >= 0) {
    unusedDays = new Decimal(unusedDaysInput);
  } else {
    const tenure = tenureYearsDecimal(contractStart, reference, warnings);
    unusedDays = Decimal.min(
      ANNUAL_VACATION_WORKING_DAYS,
      ANNUAL_VACATION_WORKING_DAYS.times(Decimal.min(new Decimal(1), tenure)),
    );
    assumed = true;
    warnings.push(
      "Dias de férias não gozadas não indicados — estimativa por antiguidade (até 22 dias).",
    );
  }
  const provision = roundMoney(unusedDays.times(dailyVacation));
  return { unusedDays, provision, assumed };
}

function calcMedicalProvision(
  annualCost: Decimal,
  contractStart: Date,
  reference: Date,
  warnings: string[],
) {
  const yearStart = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
  const periodStart = contractStart > yearStart ? contractStart : yearStart;
  const months = monthsBetweenInclusive(periodStart, reference);
  const prov = roundMoney(annualCost.times(months.div(12)));
  if (annualCost.isZero()) {
    warnings.push("Provisão de exames médicos = 0 (custo anual zero ou inválido).");
  }
  return prov;
}

function serializeMoney(d: Decimal): string {
  return d.toFixed(2);
}

function handleCalc(body: CalcInput) {
  const warnings: string[] = [];

  const baseSalary = toDecimal(body.base_salary, "base_salary", warnings);
  const bonuses = toDecimal(body.bonuses, "bonuses", warnings);
  const mealAllowance = toDecimal(body.meal_allowance, "meal_allowance", warnings);
  const insuranceValue = toDecimal(body.insurance_value, "insurance_value", warnings);

  const contractStart = parseISODate(
    String(body.contract_start_date ?? ""),
    "contract_start_date",
    warnings,
  );
  if (!contractStart) {
    return jsonResponse(
      { ok: false, error: "contract_start_date obrigatória e válida (ISO 8601).", warnings },
      400,
    );
  }

  const refRaw = body.reference_date
    ? parseISODate(String(body.reference_date), "reference_date", warnings)
    : new Date();
  const reference = refRaw ?? new Date();
  if (body.reference_date && !refRaw) {
    return jsonResponse(
      { ok: false, error: "reference_date inválida.", warnings },
      400,
    );
  }

  if (startOfDayUTC(contractStart) > startOfDayUTC(reference)) {
    return jsonResponse(
      {
        ok: false,
        error: "contract_start_date não pode ser posterior à data de referência.",
        warnings,
      },
      400,
    );
  }

  const includeMeal = Boolean(body.include_meal_in_tsu);
  const medicalAnnual = toDecimal(
    body.medical_exam_annual_cost ?? DEFAULT_MEDICAL_PROVISION,
    "medical_exam_annual_cost",
    warnings,
  );

  const referenceMonthly = roundMoney(baseSalary.plus(bonuses));

  const tsu = calcTsu(baseSalary, bonuses, mealAllowance, includeMeal, warnings);
  const subsidies = calcSubsidiesProportional(
    referenceMonthly,
    contractStart,
    reference,
    warnings,
  );
  const termination = calcIndemnitySafeguard(
    referenceMonthly,
    contractStart,
    reference,
    warnings,
  );
  const vacation = calcVacationProvision(
    baseSalary,
    contractStart,
    reference,
    body.unused_vacation_days,
    warnings,
  );
  const medical = calcMedicalProvision(medicalAnnual, contractStart, reference, warnings);

  const provisionsTotal = subsidies.feriasProportional
    .plus(subsidies.natalProportional)
    .plus(termination.indemnityValue)
    .plus(vacation.provision)
    .plus(medical)
    .plus(insuranceValue);

  const monthlyEmployerCash = referenceMonthly.plus(mealAllowance).plus(insuranceValue);
  const monthlyEmployerCostEstimate = roundMoney(
    monthlyEmployerCash.plus(tsu.employerAmount),
  );

  if (baseSalary.isZero() && bonuses.isZero()) {
    warnings.push(
      "Salário base e prémios são zero — resultados são meramente ilustrativos.",
    );
  }

  return jsonResponse({
    ok: true,
    warnings,
    disclaimer:
      "Estimativa interna. Confirme sempre com contabilista certificado e legislação em vigor.",
    input: {
      base_salary: serializeMoney(baseSalary),
      bonuses: serializeMoney(bonuses),
      meal_allowance: serializeMoney(mealAllowance),
      insurance_value: serializeMoney(insuranceValue),
      contract_start_date: contractStart.toISOString().slice(0, 10),
      reference_date: reference.toISOString().slice(0, 10),
      include_meal_in_tsu: includeMeal,
    },
    tsu: {
      employerRate: TSU_EMPLOYER_RATE.toFixed(4),
      employeeRate: TSU_EMPLOYEE_RATE.toFixed(4),
      incidenceBase: serializeMoney(tsu.incidenceBase),
      employerAmount: serializeMoney(tsu.employerAmount),
      employeeAmount: serializeMoney(tsu.employeeAmount),
      totalTsuCharge: serializeMoney(tsu.totalCharge),
    },
    subsidies: {
      referenceMonthly: serializeMoney(referenceMonthly),
      feriasProportional: serializeMoney(subsidies.feriasProportional),
      natalProportional: serializeMoney(subsidies.natalProportional),
      monthsCountedInYear: subsidies.monthsCounted.toString(),
      accrualFraction: subsidies.fraction.toFixed(4),
      method:
        "Proporcional aos meses civis entre o início (ou 1 jan) e a data de referência, até 12/12.",
    },
    termination: {
      tenureYears: termination.tenureYears.toFixed(4),
      rawIndemnityDays: termination.rawIndemnityDays.toFixed(2),
      cappedIndemnityDays: termination.cappedIndemnityDays.toFixed(2),
      indemnitySafeguard: serializeMoney(termination.indemnityValue),
      capByTwelveMonths: serializeMoney(termination.valueCapByMonths),
      capApplied: termination.capApplied,
      model:
        "18 dias de retribuição base por ano (aprox.), teto 240 dias e 12 × mensal (simplificado).",
    },
    vacation: {
      unusedVacationDays: vacation.unusedDays.toFixed(2),
      provisionUnusedVacation: serializeMoney(vacation.provision),
      assumedUnusedDays: vacation.assumed,
      dailyVacationValue: serializeMoney(baseSalary.div(ANNUAL_VACATION_WORKING_DAYS)),
    },
    medicalExams: {
      annualBudget: serializeMoney(medicalAnnual),
      provisionProportional: serializeMoney(medical),
    },
    insuranceEmployerMonthly: serializeMoney(insuranceValue),
    totals: {
      monthlyEmployerCostEstimate: serializeMoney(monthlyEmployerCostEstimate),
      provisionsTotalEstimate: serializeMoney(roundMoney(provisionsTotal)),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Use POST com JSON no corpo." }, 405);
    }

    let body: CalcInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "JSON inválido no corpo do pedido." }, 400);
    }

    return handleCalc(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    console.error("calculate_employee_costs:", e);
    return jsonResponse(
      {
        ok: false,
        error: "Falha ao calcular. Verifique os dados.",
        detail: message,
      },
      500,
    );
  }
});
