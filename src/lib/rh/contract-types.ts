/**
 * Tipos de contrato (tipo base) e modalidades de execução — Portugal / Código do Trabalho.
 *
 * - `TIPOS_CONTRATO_BASE_PT`: figura principal do contrato (um valor no `<select>`).
 * - `MODALIDADES_CONTRATO_PT`: teletrabalho, tempo parcial, etc. — combináveis com o tipo base (checkboxes).
 *
 * `tipo_contrato` na BD guarda o rótulo legal do tipo base (`tipoContratoLabelFromKey`).
 * Modalidades ficam em colunas dedicadas (`contrato_modalidade_*`).
 */
export const TIPOS_CONTRATO_BASE_PT = [
  {
    value: 'sem_termo',
    label: 'Contrato sem termo (tempo indeterminado)',
  },
  {
    value: 'termo_certo',
    label: 'Contrato a termo certo',
  },
  {
    value: 'termo_incerto',
    label: 'Contrato a termo incerto',
  },
  {
    value: 'trabalho_temporario',
    label: 'Contrato de trabalho temporário (situações do art. 140.º CT)',
  },
  {
    value: 'temporario_curta_duracao',
    label: 'Contrato de duração inferior a 15 dias (art. 148.º CT)',
  },
  {
    value: 'estagio_profissional',
    label: 'Estágio profissional',
  },
  {
    value: 'fct',
    label: 'Contrato de formação em contexto de trabalho (FCT)',
  },
  {
    value: 'estagio_acesso_profissao',
    label: 'Estágio de acesso à profissão regulamentada',
  },
  {
    value: 'fixo_descontinuo',
    label: 'Contrato de trabalho fixo-descontinuo',
  },
  {
    value: 'contrato_mae_substituicao',
    label: 'Contrato em regime de adaptação / substituição (ex.: parentalidade)',
  },
  {
    value: 'outro',
    label: 'Outro (especificar em “Outra modalidade / notas” abaixo ou nas observações da ficha)',
  },
] as const

/** @deprecated Use TIPOS_CONTRATO_BASE_PT — nome legado para imports antigos. */
export const TIPOS_CONTRATO_PT = TIPOS_CONTRATO_BASE_PT

export const MODALIDADES_CONTRATO_PT = [
  {
    key: 'teletrabalho' as const,
    label: 'Teletrabalho',
    hint: 'Modalidade de prestação de trabalho, combinável com o tipo base.',
  },
  {
    key: 'tempo_parcial' as const,
    label: 'Tempo parcial',
    hint: 'Modalidade de organização do tempo de trabalho / retribuição, combinável com o tipo base.',
  },
] as const

export type TipoContratoKey = (typeof TIPOS_CONTRATO_BASE_PT)[number]['value']

const LABEL_BY_VALUE = Object.fromEntries(TIPOS_CONTRATO_BASE_PT.map((t) => [t.value, t.label])) as Record<
  string,
  string
>

export function tipoContratoLabelFromKey(key: string): string {
  return LABEL_BY_VALUE[key] ?? key
}

export const TIPO_CONTRATO_KEYS = TIPOS_CONTRATO_BASE_PT.map((t) => t.value)

export function isValidTipoContratoKey(key: string): key is TipoContratoKey {
  return TIPO_CONTRATO_KEYS.includes(key as TipoContratoKey)
}
