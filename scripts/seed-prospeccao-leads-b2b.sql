-- =============================================================================
-- Seed: 20 leads de prospecção B2B → public.leads_inbound (CRM Flowly existente)
-- =============================================================================
-- IMPORTANTE — Este script NÃO envia emails.
--   Só executa INSERT na base de dados. Resend / Next.js / campanhas não são
--   invocados pelo SQL. Podes rever leads no CRM e enviar emails manualmente
--   quando quiseres (ex.: acção «Enviar email» na ficha da lead).
--
-- Mapeamento (não cria tabela nova):
--   nome              → nome comercial / designação curta
--   empresa           → razão social ou nome completo
--   email             → contacto geral da empresa (NOT NULL na BD; para envio
--                       real usas o CRM / Resend a partir da aplicação).
--   telemovel         → contacto telefónico (fixos PT; texto livre)
--   tipo_projeto      → valor genérico coerente com o CRM (texto livre na BD)
--   descricao         → resumo operacional (dor + local + nicho) para triagem
--   origem            → 'prospeccao'
--   estado / stage_id → 'new' («Nova» no pipeline)
--   metadata          → localizacao, nicho_principal, dor_operacional,
--                       guiao_venda (pitch completo), status_contacto, seed,
--                       handoff (escopo_resumo, proximos_passos_delivery,
--                       contacto_delivery) — visível em «Handoff comercial → delivery»
--
-- Execução: Supabase SQL Editor, ou `psql`, ou `supabase db execute` conforme o teu fluxo.
-- =============================================================================

BEGIN;

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'MGETENSÃO',
  'geral@mgetensao.pt',
  '266 247 194',
  'MGETENSÃO',
  'automacoes-integracoes',
  NULL, NULL,
  'Évora · Instalações elétricas. Dor operacional: papelada entre técnicos de terreno e escritório — assinaturas e folhas de obra em papel.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Instalações Elétricas',
    'dor_operacional', 'Papelada entre técnicos de terreno e escritório.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hmget$
Contexto da lead (prospecção B2B — seed) para perceberem a empresa antes de qualquer trabalho de delivery:

• Empresa: MGETENSÃO · Évora
• Nicho: instalações elétricas
• Dor operacional: papelada entre técnicos de terreno e escritório (folhas de obra, assinaturas físicas, ida e volta de papel)
• Ângulo do guião comercial / chamada: eliminar folha de obra em papel; passar a assinatura e registo digital em tablet, com trilho auditável por cliente

O pitch completo enviado ao comercial está em metadata.guiao_venda; nicho, local e dor também em metadata (nicho_principal, localizacao, dor_operacional).
$hmget$,
      'proximos_passos_delivery', 'Ainda sem diagnóstico técnico com o cliente. Quando a lead estiver qualificada, alinhar interlocutor técnico e mapear O.S. / arquivo actual e integrações (ERP, se existir).',
      'contacto_delivery', 'geral@mgetensao.pt · Tel. 266 247 194'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — desenvolvemos software e integrações à medida de empresas em Portugal.

Na MGETENSÃO, no sector de instalações elétricas em Évora, percebemos que a coordenação entre equipas no terreno e o escritório ainda depende muito de papel: folhas de obra, duplicados e idas e vindas que atrasam faturação e fecho de serviços.

O nosso foco para consigo é simples: eliminar a folha de obra em papel e passar para assinatura e registo digital no tablet, com trilho auditável do que foi feito em cada cliente.

Oferecemos um diagnóstico gratuito de cerca de 30 minutos: percorremos o fluxo actual (desde a ordem de serviço até ao arquivo), identificamos onde se perde tempo e se há encaixe com uma solução enxuta — sem compromisso e sem «pack» genérico.

Se fizer sentido, responda com duas janelas para uma breve chamada ou diga o melhor contacto para o departamento comercial.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Évoragas',
  'geral@evoragas.pt',
  '266 737 400',
  'Évoragas',
  'sistema-gestao',
  NULL, NULL,
  'Évora · Distribuição de gás. Dor: logística de garrafas e manutenção de frota pesada — rotas e alertas pouco estruturados.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Distribuição de Gás',
    'dor_operacional', 'Logística de garrafas e manutenção de frota pesada.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hevoragas$
Contexto da lead (prospecção B2B — seed):

• Empresa: Évoragas · Évora
• Nicho: distribuição de gás
• Dor operacional: logística de garrafas e manutenção de frota pesada (rotas, desgaste, alertas pouco estruturados)
• Ângulo do guião comercial: controlo de rotas e alertas automáticos de manutenção das carrinhas / frota

Pitch longo: metadata.guiao_venda.
$hevoragas$,
      'proximos_passos_delivery', 'Sem visita ou diagnóstico ainda. Futuro delivery: perceber TMS/planificação actual, oficina e calendário de manutenção legal das viaturas.',
      'contacto_delivery', 'geral@evoragas.pt · Tel. 266 737 400'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — apoiamos distribuidores e operadores logísticos com ferramentas à medida.

Na Évoragas, a gestão da logística de garrafas e o desgaste da frota pesada costumam gerar custos invisíveis: rotas mal optimizadas, manutenções reactivas e pouca visibilidade de alertas para revisões e inspecções.

Propomos centrar a conversa no controlo de rotas e em alertas automáticos de manutenção preventiva das carrinhas, ligados ao uso real (quilómetros, ciclos de carga/descarga ou calendário técnico).

Convidamo-lo a um diagnóstico gratuito: em meia hora desenhamos o mapa actual e indicamos quick-wins realistas. Sem obrigação de avançar para projecto.

Indique duas datas para uma chamada breve ou o contacto preferido.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Vinhalentejo',
  'geral@vinhalentejo.pt',
  '266 744 454',
  'Vinhalentejo',
  'ecommerce',
  NULL, NULL,
  'Évora · Distribuição de bebidas. Dor: encomendas por telefone sem stock real — risco de ruptura e sobrencomenda.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Distribuição de Bebidas',
    'dor_operacional', 'Encomendas por telefone sem controlo de stock real.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hvinha$
Contexto da lead (prospecção B2B — seed):

• Empresa: Vinhalentejo · Évora
• Nicho: distribuição de bebidas
• Dor operacional: encomendas por telefone sem controlo de stock real (ruptura vs. sobrencomenda)
• Ângulo do guião comercial: portal B2B para restaurantes pedirem directo com abate de stock

Pitch longo: metadata.guiao_venda.
$hvinha$,
      'proximos_passos_delivery', 'Sem integração mapeada. Delivery futuro: ERP/armazém, catálogo B2B e regras de disponibilidade por cliente.',
      'contacto_delivery', 'geral@vinhalentejo.pt · Tel. 266 744 454'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — ajudamos distribuidores HORECA a digitalizar pedidos e stock.

Na Vinhalentejo, o volume de encomendas por telefone sem amarração ao stock real cria incerteza: ou falta produto no cliente ou sobem inventários parados.

Sugerimos apresentar um portal B2B onde restaurantes e clientes habituais fazem pedidos directos que abatem no armazém, com visibilidade de disponibilidade e histórico.

Marcamos um diagnóstico gratuito para perceber encaixe com Primavera/PHC ou outro ERP e o esforço de arranque. Responda com duas datas ou o melhor número para o responsável comercial.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'PREDOMÍNIO',
  'predominio@predominio.pt',
  '213 151 515',
  'PREDOMÍNIO',
  'sistema-gestao',
  NULL, NULL,
  'Lisboa · Gestão de condomínios. Dor: caos no reporte de avarias por telefone — triagem lenta de canalizadores e eletricistas.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Lisboa',
    'nicho_principal', 'Gestão de Condomínios',
    'dor_operacional', 'Caos no reporte de avarias por telefone.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hpred$
Contexto da lead (prospecção B2B — seed):

• Empresa: PREDOMÍNIO · Lisboa
• Nicho: gestão de condomínios
• Dor operacional: caos no reporte de avarias (telefone como canal único; pouco contexto para triagem)
• Ângulo do guião comercial: sistema de ticketing com fotos para triagem rápida de reparações (canalizadores, eletricistas, SLA)

Pitch longo: metadata.guiao_venda.
$hpred$,
      'proximos_passos_delivery', 'Sem integrações mapeadas. Delivery futuro: canais de entrada actuais, SLAs internos, e se há software de condomínio ou só processos manuais.',
      'contacto_delivery', 'predominio@predominio.pt · Tel. 213 151 515'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — desenvolvemos plataformas para operação e atendimento com trilho digital.

Na PREDOMÍNIO, na gestão de condomínios em Lisboa, o telefone como canal único de avarias dilui prioridades: falta contexto (fotos, localização exacta) e a triagem para canalizadores/eletricistas torna-se lenta.

Propomos um sistema de ticketing com fotos e classificação, para triagem rápida e métricas de SLA por condomínio.

Oferecemos diagnóstico gratuito de 30 minutos para mapear canais actuais e requisitos mínimos de integração. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'RS Oficinas',
  'geral@rsoficinas.pt',
  '218 310 330',
  'RS Oficinas',
  'app-operacional',
  NULL, NULL,
  'Lisboa · Oficina auto. Dor: lentidão na aprovação de orçamentos extras — comunicação com cliente dispersa.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Lisboa',
    'nicho_principal', 'Oficina Auto',
    'dor_operacional', 'Lentidão na aprovação de orçamentos extras.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hrs$
Contexto da lead (prospecção B2B — seed):

• Empresa: RS Oficinas · Lisboa
• Nicho: oficina automóvel
• Dor operacional: lentidão na aprovação de orçamentos / trabalhos extra (comunicação com cliente dispersa)
• Ângulo do guião comercial: app para o mecânico enviar fotos da peça para o WhatsApp do cliente, com registo interno

Pitch longo: metadata.guiao_venda.
$hrs$,
      'proximos_passos_delivery', 'Sem fluxo de taller mapeado. Delivery: perceber gestão de orçamentos, WhatsApp vs. canal oficial e arquivo para IVA.',
      'contacto_delivery', 'geral@rsoficinas.pt · Tel. 218 310 330'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — criamos apps operacionais ligadas a WhatsApp e email onde faz sentido.

Na RS Oficinas, a aprovação de trabalhos extra sofre quando o mecânico não consegue mostrar rapidamente a peça danificada ao decisor — telefonemas e fotos soltas atrasam fechos.

Sugerimos uma app simples para o mecânico registar intervenção e enviar fotos da peça directamente para o WhatsApp do cliente, com registo interno para arquivo e facturação.

Diagnóstico gratuito: percebemos o fluxo actual e se vale a pena um MVP em semanas. Indique disponibilidade para uma chamada curta.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Alfaiate & Santos',
  'geral@alfaiatesantos.pt',
  '266 739 120',
  'Alfaiate & Santos',
  'ecommerce',
  NULL, NULL,
  'Évora · Materiais de construção. Dor: orçamentação lenta de materiais pesados — transporte e prazos pouco transparentes para o cliente.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Materiais de Construção',
    'dor_operacional', 'Orçamentação lenta de materiais pesados.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $half$
Contexto da lead (prospecção B2B — seed):

• Empresa: Alfaiate & Santos · Évora
• Nicho: materiais de construção
• Dor operacional: orçamentação pesada / lenta (transporte, prazos pouco transparentes para o cliente B2B)
• Ângulo do guião comercial: digitalização do catálogo com calculador de transporte incluído

Pitch longo: metadata.guiao_venda.
$half$,
      'proximos_passos_delivery', 'Sem ERP/catálogo digital definido. Delivery: dados mestres de produtos, tabelas de frete e integração com vendas internas.',
      'contacto_delivery', 'geral@alfaiatesantos.pt · Tel. 266 739 120'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — unimos catálogos, logística e experiência de compra B2B.

Na Alfaiate & Santos, orçamentos de materiais pesados demoram quando o cálculo de transporte e lead time não está estruturado — o cliente profissional perde confiança.

Propomos digitalizar o catálogo com calculador de transporte incluído, para respostas rápidas e consistentes.

Convidamo-lo a um diagnóstico gratuito: 30 minutos para rever dados mestres e integrações possíveis. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Pinto & Filhos',
  'geral@pintoefilhos.pt',
  '266 749 610',
  'Pinto & Filhos (BigMat)',
  'app-operacional',
  NULL, NULL,
  'Évora · Bricolage e construção (BigMat). Dor: gestão de stocks em grandes áreas — divergências entre armazém e loja.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Bricolage e Construção (BigMat)',
    'dor_operacional', 'Gestão de stocks em grandes áreas.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hpinto$
Contexto da lead (prospecção B2B — seed):

• Empresa: Pinto & Filhos (BigMat) · Évora
• Nicho: bricolage / retalho construção (BigMat)
• Dor operacional: gestão de stocks em armazém e grandes áreas (armazém vs. loja)
• Ângulo do guião comercial: app de inventário móvel para funcionários de armazém (contagens, zonas)

Pitch longo: metadata.guiao_venda.
$hpinto$,
      'proximos_passos_delivery', 'Sem WMS detalhado. Delivery: sistema de stock actual, contagens cíclicas e perfis de utilizador no armazém.',
      'contacto_delivery', 'geral@pintoefilhos.pt · Tel. 266 749 610'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — apoiamos retalho B2B com inventário móvel e reconciliação.

Na Pinto & Filhos, grandes áreas de exposição e armazém aumentam o risco de desvios entre o que o sistema diz e o que está fisicamente nas prateleiras.

Focamos a conversa numa app de inventário móvel para equipas de armazém, com contagens dirigidas e auditoria por zona.

Diagnóstico gratuito para dimensionar esforço e ROI. Responda com duas datas ou o contacto de operações.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'FROSTLINE',
  'geral@frostline.pt',
  '212 110 030',
  'FROSTLINE',
  'app-operacional',
  NULL, NULL,
  'Lisboa · AVAC e climatização. Dor: gestão de 10+ equipas técnicas na rua — falta visibilidade e fecho de obra.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Lisboa',
    'nicho_principal', 'AVAC / Climatização',
    'dor_operacional', 'Gestão de 10+ equipas técnicas na rua.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hfrost$
Contexto da lead (prospecção B2B — seed):

• Empresa: FROSTLINE · Lisboa
• Nicho: AVAC / climatização
• Dor operacional: coordenação de múltiplas equipas técnicas em deslocação (visibilidade, peças, fecho de obra)
• Ângulo do guião comercial: dashboard de geolocalização de técnicos + fecho de obra digital (checklist, fotos)

Pitch longo: metadata.guiao_venda.
$hfrost$,
      'proximos_passos_delivery', 'Sem field service tool mapeado. Delivery: backoffice actual, ordens de serviço e necessidade de offline no telemóvel.',
      'contacto_delivery', 'geral@frostline.pt · Tel. 212 110 030'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — construímos dashboards e apps de campo para serviços técnicos.

Na FROSTLINE, com muitas equipas AVAC em deslocação, coordenar prioridades, peças e fecho de obra sem ferramenta única gera retrabalho e reclamações.

Propomos destacar geolocalização de técnicos em tempo útil e fecho de obra digital (checklist, fotos, assinatura), integrado ao vosso backoffice quando existir.

Marcamos diagnóstico gratuito de 30 minutos — mapeamos integrações e risco. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Sodrel, SA',
  'sodrel@sodrel.pt',
  '245 301 020',
  'Sodrel, SA',
  'automacoes-integracoes',
  NULL, NULL,
  'Portalegre · Logística e distribuição. Dor: erros manuais na faturação de rota — desalinhamento entre comercial de rua e sistema central.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Portalegre',
    'nicho_principal', 'Logística / Distribuição',
    'dor_operacional', 'Erros manuais na faturação de rota.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hsodrel$
Contexto da lead (prospecção B2B — seed):

• Empresa: Sodrel, SA · Portalegre
• Nicho: logística / distribuição
• Dor operacional: erros manuais na faturação de rota (lacuna entre comercial de rua e sistema central)
• Ângulo do guião comercial: integração do comercial de rua com a faturação central (validações, excepções)

Pitch longo: metadata.guiao_venda.
$hsodrel$,
      'proximos_passos_delivery', 'Sem ERP nomeado no dossier. Delivery: identificar ERP/faturação, dispositivos de rua e regras de preço por rota.',
      'contacto_delivery', 'sodrel@sodrel.pt · Tel. 245 301 020'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — integramos equipas de rua com faturação e ERP sem duplicar trabalho.

Na Sodrel, erros na faturação de rota normalmente nascem da lacuna entre o que o comercial confirma no terreno e o que o escritório introduz à mão.

Sugerimos integrar o fluxo comercial de rua com o sistema de faturação central: regras de validação, catálogos e trilho de excepções.

Diagnóstico gratuito para listar sistemas actuais e um caminho incremental. Indique disponibilidade.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Vibeirinho',
  'geral@vibeirinho.pt',
  '219 405 500',
  'Vibeirinho',
  'sistema-gestao',
  NULL, NULL,
  'Lisboa · Torrefação e cafés. Dor: manutenção de máquinas de café em clientes HORECA — planeamento preventivo disperso.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Lisboa',
    'nicho_principal', 'Torrefação / Cafés',
    'dor_operacional', 'Manutenção de máquinas de café em clientes (HORECA).',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hvibe$
Contexto da lead (prospecção B2B — seed):

• Empresa: Vibeirinho · Lisboa
• Nicho: torrefação / cafés (equipamento em clientes HORECA)
• Dor operacional: manutenção de máquinas de café dispersas em clientes (preventivo pouco estruturado)
• Ângulo do guião comercial: manutenção preventiva por máquina e por cliente (lembretes, histórico, peças)

Pitch longo: metadata.guiao_venda.
$hvibe$,
      'proximos_passos_delivery', 'Sem CMMS mapeado. Delivery: número de máquinas, contratos com clientes e ferramentas actuais (folha, CRM).',
      'contacto_delivery', 'geral@vibeirinho.pt · Tel. 219 405 500'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — damos visibilidade a equipamentos espalhados por clientes.

Na Vibeirinho, manter máquinas em HORECA sem cadência de manutenção preventiva aumenta paragens e visitas de emergência.

Propomos um sistema de manutenção preventiva por máquina e por cliente, com lembretes, histórico de intervenções e peças trocadas.

Oferecemos diagnóstico gratuito para alinhar com o vosso CRM ou folhas actuais. Responda com duas janelas para chamada.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Ribeiro & Ca',
  'geral@ribeiroeca.pt',
  '266 748 100',
  'Ribeiro & Ca',
  'app-operacional',
  NULL, NULL,
  'Évora · Distribuição alimentar. Dor: falhas na conferência de carga no cais — divergências na expedição.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Distribuição Alimentar',
    'dor_operacional', 'Falhas na conferência de carga no cais.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hribe$
Contexto da lead (prospecção B2B — seed):

• Empresa: Ribeiro & Ca · Évora
• Nicho: distribuição alimentar
• Dor operacional: falhas na conferência de carga no cais (expedição, devoluções, tempo de viatura)
• Ângulo do guião comercial: app de conferência de mercadoria por código de barras (tolerâncias, excepções com foto)

Pitch longo: metadata.guiao_venda.
$hribe$,
      'proximos_passos_delivery', 'Sem hardware mapeado. Delivery: leitores, picking actual e integração com expedição / ERP.',
      'contacto_delivery', 'geral@ribeiroeca.pt · Tel. 266 748 100'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — reduzimos erros na última milha com digitalização simples no cais.

Na Ribeiro & Ca, falhas na conferência de carga geram devoluções, reclamações e tempo parado de viaturas.

Focamos numa app de conferência por código de barras, com regras de tolerância e registo fotográfico opcional para excepções.

Diagnóstico gratuito de 30 minutos para perceber hardware e integração com picking. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Oficina Auto-Chique',
  'geral@autochique.pt',
  '245 201 155',
  'Oficina Auto-Chique',
  'app-operacional',
  NULL, NULL,
  'Portalegre · Reparação automóvel. Dor: gestão de histórico de viaturas — cliente sem visibilidade do progresso.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Portalegre',
    'nicho_principal', 'Reparação Automóvel',
    'dor_operacional', 'Gestão de histórico de viaturas.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hchique$
Contexto da lead (prospecção B2B — seed):

• Empresa: Oficina Auto-Chique · Portalegre
• Nicho: reparação automóvel
• Dor operacional: histórico de viaturas e progresso da reparação disperso do ponto de vista do cliente
• Ângulo do guião comercial: portal de cliente com fotos do progresso da reparação e aprovações

Pitch longo: metadata.guiao_venda.
$hchique$,
      'proximos_passos_delivery', 'Sem DMS nomeado. Delivery: software de taller actual, RGPD de fotos e modelo de aprovação de trabalhos.',
      'contacto_delivery', 'geral@autochique.pt · Tel. 245 201 155'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — criamos portais de cliente que reduzem chamadas «para saber como vai».

Na Oficina Auto-Chique, um histórico rico no taller não chega se o cliente não vê fotos do progresso e aprovações de trabalhos.

Propomos um portal onde o cliente acompanha estado, fotos e autorizações, com notificações por email ou SMS conforme preferência.

Marcamos diagnóstico gratuito para definir MVP e privacidade de dados. Indique o melhor contacto.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Construções J.M.S.',
  'geral@construcoesjms.pt',
  '245 330 330',
  'Construções J.M.S.',
  'sistema-gestao',
  NULL, NULL,
  'Portalegre · Construção civil. Dor: derrapagem de custos em materiais de obra — falta de controlo em tempo real.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Portalegre',
    'nicho_principal', 'Construção Civil',
    'dor_operacional', 'Derrapagem de custos em materiais de obra.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hjms$
Contexto da lead (prospecção B2B — seed):

• Empresa: Construções J.M.S. · Portalegre
• Nicho: construção civil
• Dor operacional: derrapagem de custos em materiais de obra (controlo tardio)
• Ângulo do guião comercial: controlo de custos em tempo real via app para encarregados (consumos, desvios, entregas)

Pitch longo: metadata.guiao_venda.
$hjms$,
      'proximos_passos_delivery', 'Sem obra piloto definida. Delivery: fluxo de compras da obra, responsáveis no terreno e relatórios para administração.',
      'contacto_delivery', 'geral@construcoesjms.pt · Tel. 245 330 330'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — ligamos obra, compras e custos com relatórios accionáveis.

Na Construções J.M.S., a derrapagem de materiais costuma aparecer tarde — quando já consumiu margem.

Sugerimos controlo de custos de obra em tempo real via app para encarregados: consumos, desvios e fotos de entrega no fornecedor.

Diagnóstico gratuito para rever processo de compras e relatórios desejados. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Sertotal',
  'geral@sertotal.pt',
  '266 745 220',
  'Sertotal',
  'app-operacional',
  NULL, NULL,
  'Évora · Limpeza e manutenção. Dor: escalas de turnos com 50+ pessoas — registo de presenças e conformidade.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Limpeza e Manutenção',
    'dor_operacional', 'Escalas de turnos de 50+ pessoas.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hsert$
Contexto da lead (prospecção B2B — seed):

• Empresa: Sertotal · Évora
• Nicho: limpeza e manutenção
• Dor operacional: escalas de turnos grandes (50+ pessoas) — substituições, prova de presença em cliente
• Ângulo do guião comercial: picagem de ponto por GPS no telemóvel (geofence por cliente, relatórios RH)

Pitch longo: metadata.guiao_venda.
$hsert$,
      'proximos_passos_delivery', 'Requer alinhamento jurídico (trabalho em terceiros, GPS, consentimentos). Delivery: políticas RH actuais e ferramenta de escala actual.',
      'contacto_delivery', 'geral@sertotal.pt · Tel. 266 745 220'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — apoiamos empresas de serviços com equipas numerosas.

Na Sertotal, gerir turnos grandes sem ferramenta única complica substituições, horas extra e prova de presenças em cliente.

Propomos picagem de ponto por GPS no telemóvel da funcionária, com geofence por cliente e relatórios para RH.

Oferecemos diagnóstico gratuito para alinhar regras legais e privacidade. Responda com disponibilidade.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Prime Clean Évora',
  'evora@primeclean.pt',
  '266 098 120',
  'Prime Clean Évora',
  'app-operacional',
  NULL, NULL,
  'Évora · Limpezas profissionais. Dor: gestão de consumíveis e stocks nos clientes — ruturas que só aparecem no dia da falta.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Limpezas Profissionais',
    'dor_operacional', 'Gestão de consumíveis e stocks nos clientes.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hprime$
Contexto da lead (prospecção B2B — seed):

• Empresa: Prime Clean Évora · Évora
• Nicho: limpezas profissionais (outsourcing em clientes)
• Dor operacional: gestão de consumíveis e stocks nos clientes (ruturas tardias)
• Ângulo do guião comercial: reporte automático de rutura de stock de detergentes / consumíveis via app

Pitch longo: metadata.guiao_venda.
$hprime$,
      'proximos_passos_delivery', 'Delivery: lista de SKUs por cliente, frequência de visitas e quem repõe (taller vs. cliente).',
      'contacto_delivery', 'evora@primeclean.pt · Tel. 266 098 120'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — damos previsibilidade a consumíveis em regime de outsourcing.

Na Prime Clean Évora, detergentes e consumíveis nos clientes fogem ao controlo quando o reporte é verbal ou esporádico.

Focamos em reporte automático de rutura de stock via app (leitura rápida por local e SKU), com alertas para reposição.

Diagnóstico gratuito de 30 minutos para listar SKUs e frequência de visitas. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Sociedade Agrícola de Évora',
  'geral@saevora.pt',
  '266 748 700',
  'Sociedade Agrícola de Évora',
  'sistema-gestao',
  NULL, NULL,
  'Évora · Vinho e agricultura. Dor: gestão de mão-de-obra sazonal — produtividade e presenças no campo.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Vinho / Agricultura',
    'dor_operacional', 'Gestão de mão-de-obra sazonal.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hsae$
Contexto da lead (prospecção B2B — seed):

• Empresa: Sociedade Agrícola de Évora · Évora
• Nicho: vinho / agricultura
• Dor operacional: gestão de mão-de-obra sazonal e produtividade no campo
• Ângulo do guião comercial: tarefas e produtividade diária no campo (check-ins, equipas por parcela)

Pitch longo: metadata.guiao_venda.
$hsae$,
      'proximos_passos_delivery', 'Delivery: encaixe com práticas e RGPD; picagens vs. confiança em equipas sazonais.',
      'contacto_delivery', 'geral@saevora.pt · Tel. 266 748 700'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — apoiamos operações agrícolas com ferramentas simples no terreno.

Na Sociedade Agrícola de Évora, a sazonalidade concentra picos de contratação e tarefas dispersas — difícil medir produtividade diária.

Propomos gestão de tarefas e produtividade no campo, com check-ins e registo de equipas por parcela ou linha de trabalho.

Convidamo-lo a um diagnóstico gratuito para perceber encaixe com práticas actuais e RGPD. Indique duas datas.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'J.P. Peças',
  'geral@jppecas.pt',
  '218 642 000',
  'J.P. Peças',
  'automacoes-integracoes',
  NULL, NULL,
  'Lisboa · Peças automóvel. Dor: logística de entregas urgentes — rotas e tempos de resposta.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Lisboa',
    'nicho_principal', 'Peças Automóvel',
    'dor_operacional', 'Logística de entregas urgentes.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hjp$
Contexto da lead (prospecção B2B — seed):

• Empresa: J.P. Peças · Lisboa
• Nicho: peças automóvel
• Dor operacional: logística de entregas urgentes (rotas, SLA, stock vs. trânsito)
• Ângulo do guião comercial: optimização de rotas para carrinhas de entrega rápida e confirmação de entrega

Pitch longo: metadata.guiao_venda.
$hjp$,
      'proximos_passos_delivery', 'Delivery: volumes diários, zonas de entrega e integração com despacho / ERP actual.',
      'contacto_delivery', 'geral@jppecas.pt · Tel. 218 642 000'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — optimizamos rotas e priorização para distribuição B2B.

Na J.P. Peças, entregas urgentes penalizam quando o despacho não cruza stock, trânsito e janelas de cliente.

Sugerimos otimização de rotas para carrinhas de entrega rápida, com regras de SLA por tipo de cliente e confirmação de entrega.

Diagnóstico gratuito para mapear volumes e integrações. Responda com o contacto de logística.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Pneualentejo',
  'geral@pneualentejo.pt',
  '266 744 440',
  'Pneualentejo',
  'gestao-filas',
  NULL, NULL,
  'Évora · Serviços de pneus. Dor: fila de espera e marcações mal geridas — perda de tempo e de receita.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Serviços de Pneus',
    'dor_operacional', 'Fila de espera e marcações mal geridas.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hpneu$
Contexto da lead (prospecção B2B — seed):

• Empresa: Pneualentejo · Évora
• Nicho: serviços de pneus
• Dor operacional: filas de espera e marcações mal geridas (perda de tempo e receita)
• Ângulo do guião comercial: marcação online + gestão de filas com alerta SMS (reduzir no-show)

Pitch longo: metadata.guiao_venda.
$hpneu$,
      'proximos_passos_delivery', 'Delivery: número de boxes, canais de marcação actuais (telefone, balcão) e SMS gateway desejado.',
      'contacto_delivery', 'geral@pneualentejo.pt · Tel. 266 744 440'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — melhoramos experiência de marcação em oficinas e centros de serviço.

Na Pneualentejo, filas e marcações frágeis geram fricção no balcão e capacidade ociosa em horas valiosas.

Propomos gestão de filas e marcação online com alerta SMS, reduzindo telefonemas repetidos e no-shows.

Oferecemos diagnóstico gratuito para perceber canais actuais e calendário de boxes. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Ambielvas',
  'geral@ambielvas.pt',
  '268 620 546',
  'Ambielvas',
  'sistema-gestao',
  NULL, NULL,
  'Elvas · Gestão de resíduos e frota. Dor: manutenção de frota pesada e contentores — inventário de ativos pouco fiável.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Elvas',
    'nicho_principal', 'Gestão de Resíduos / Frota',
    'dor_operacional', 'Manutenção de frota pesada e contentores.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hamb$
Contexto da lead (prospecção B2B — seed):

• Empresa: Ambielvas · Elvas
• Nicho: gestão de resíduos / frota
• Dor operacional: manutenção de frota pesada e contentores; inventário de ativos pouco fiável
• Ângulo do guião comercial: inventário digital de contentores + rotas de recolha com estado e responsável

Pitch longo: metadata.guiao_venda.
$hamb$,
      'proximos_passos_delivery', 'Delivery: sistema de planeamento actual, identificadores de contentores e oficina / manutenção.',
      'contacto_delivery', 'geral@ambielvas.pt · Tel. 268 620 546'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — damos visibilidade a ativos móveis e rotas de recolha.

Na Ambielvas, contentores e veículos pesados exigem manutenção e localização coerente — planilhas e papel não escala.

Focamos em inventário digital de ativos (contentores) e rotas de recolha com estado e responsável.

Diagnóstico gratuito de 30 minutos para alinhar com operações e faturação. Indique disponibilidade.

Cumprimentos,
Equipa Flowly
$g$
  )
);

INSERT INTO public.leads_inbound (
  nome, email, telemovel, empresa, tipo_projeto, orcamento, prazo, descricao,
  origem, estado, stage_id, metadata
) VALUES (
  'Sodial',
  'geral@sodial.pt',
  '266 749 050',
  'Sodial',
  'sistema-gestao',
  NULL, NULL,
  'Évora · Distribuição de alimentos. Dor: gestão de prazos de validade em armazém — risco de desperdício e não conformidade.',
  'prospeccao', 'new', 'new',
  jsonb_build_object(
    'seed', true,
    'localizacao', 'Évora',
    'nicho_principal', 'Distribuição de Alimentos',
    'dor_operacional', 'Gestão de prazos de validade em armazém.',
    'status_contacto', 'Nova',
    'handoff', jsonb_build_object(
      'escopo_resumo', $hsodial$
Contexto da lead (prospecção B2B — seed):

• Empresa: Sodial · Évora
• Nicho: distribuição de alimentos
• Dor operacional: gestão de prazos de validade em armazém (FEFO, desperdício, auditoria)
• Ângulo do guião comercial: alertas automáticos para produtos próximos do fim da validade (FEFO por família/cliente)

Pitch longo: metadata.guiao_venda.
$hsodial$,
      'proximos_passos_delivery', 'Delivery: WMS/ERP actual, regras de picking e tipos de produto (lotes, chave de validade).',
      'contacto_delivery', 'geral@sodial.pt · Tel. 266 749 050'
    ),
    'guiao_venda', $g$
Bom dia,

Sou da Flowly — ajudamos distribuidores alimentares com FEFO e alertas de validade.

Na Sodial, prazos de validade no armazém precisam de alertas automáticos e picking disciplinado — sob pena de perdas e auditorias difíceis.

Propomos sistema de alertas para produtos próximos do fim da validade (FEFO), com regras por família e cliente.

Convidamo-lo a um diagnóstico gratuito para rever WMS/ERP actuais e prioridades. Sem compromisso.

Cumprimentos,
Equipa Flowly
$g$
  )
);

COMMIT;

-- Verificação rápida (opcional):
-- SELECT id, nome, empresa, telemovel, origem, stage_id, metadata->>'localizacao' AS loc
-- FROM public.leads_inbound WHERE (metadata->>'seed')::boolean IS TRUE ORDER BY created_at DESC LIMIT 25;
