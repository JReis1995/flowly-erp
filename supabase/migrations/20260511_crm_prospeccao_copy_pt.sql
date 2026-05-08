-- Revisão de copy dos modelos de prospecção: PT comercial, menos estrangeirismos, âmbito sectorial mais abrangente.

UPDATE public.crm_email_templates
SET
  label = 'Vendas e relacionamento com clientes',
  area_label = 'CRM / Vendas',
  subject_template = 'Flowly | Da primeira conversa ao fecho: visibilidade para a sua equipa comercial',
  body_template = $body$
Muitas equipas perdem tempo a reunir informação sobre contactos e oportunidades entre correio eletrónico e folhas de cálculo.

Na Flowly ajudamos a ter uma visão única do que está em curso — próximos passos definidos e histórico acessível por cliente.

Se for relevante para {{empresa}}, posso enviar um exemplo concreto da nossa abordagem, sem qualquer compromisso.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-crm';

UPDATE public.crm_email_templates
SET
  label = 'Operações — restauração, logística, terreno',
  area_label = 'Operacional',
  subject_template = 'Flowly | Operações do dia a dia com menos fricção',
  body_template = $body$
Restauração, logística, produção ou apoio ao cliente: quando o processo depende de demasiados passos manuais, os erros e os atrasos aumentam.

Desenvolvemos aplicações à medida para apoiar o trabalho em armazém, em loja ou em deslocação — pedidos, turnos, estado de serviço e muito mais.

Se quiser, indico como costumamos começar e qual o primeiro passo que faz sentido para si.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-app-operacional';

UPDATE public.crm_email_templates
SET
  label = 'Atendimento e filas de trabalho',
  area_label = 'Filas / Apoio',
  subject_template = 'Flowly | Atendimento e prioridades mais claros para a equipa',
  body_template = $body$
Sem uma visão partilhada dos pedidos em curso, é difícil responder em tempo útil e priorizar com critério.

Ajudamos equipas de operações e apoio a organizar filas de trabalho, prioridades e acompanhamento — com menos idas e voltas por correio eletrónico.

Se {{empresa}} enfrenta este desafio, posso explicar brevemente como abordamos situações semelhantes.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-gestao-filas';

UPDATE public.crm_email_templates
SET
  label = 'Presença online e pedidos de contacto',
  area_label = 'Web',
  subject_template = 'Flowly | Presença online que gera contactos de qualidade',
  body_template = $body$
Um site credível é fundamental; o que falta muitas vezes é alinhar mensagem, provas de confiança e pedidos de contacto objetivos com o que a equipa comercial precisa de receber.

Podemos mostrar como ligamos presença digital ao acompanhamento comercial, quando for o momento certo para {{empresa}}.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-website-corporativo';

UPDATE public.crm_email_templates
SET
  label = 'Retalho online e operação',
  area_label = 'Retalho online',
  subject_template = 'Flowly | Loja online alinhada com a operação',
  body_template = $body$
Quando a loja online não está alinhada com stocks, expedição ou apoio ao cliente, aparecem falhas de stock e reclamações.

Trabalhamos no desenho de um percurso integrado — da encomenda ao pós-venda — adaptado ao ritmo do seu negócio.

Diga-me se faz sentido uma conversa exploratória breve.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-ecommerce';

UPDATE public.crm_email_templates
SET
  label = 'Gestão integrada e informação única',
  area_label = 'Gestão',
  subject_template = 'Flowly | Informação num só sítio, decisões mais rápidas',
  body_template = $body$
Quando os dados estão espalhados por várias ferramentas, a equipa perde velocidade e confiança nos números.

Desenhamos soluções de gestão alinhadas com o modo real de trabalhar da empresa — sem impor processos artificiais.

Se {{empresa}} sente esse atrito, posso sugerir um próximo passo simples e objetivo.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-sistema-gestao';

UPDATE public.crm_email_templates
SET
  label = 'Ligar sistemas e reduzir trabalho repetitivo',
  area_label = 'Integrações',
  subject_template = 'Flowly | Menos tarefas repetitivas, sistemas a trabalhar em conjunto',
  body_template = $body$
Automatizar passos que se repetem todos os dias e fazer comunicar a faturação, o armazém ou o correio eletrónico liberta tempo para o que realmente importa.

Na Flowly avaliamos integrações com foco em fiabilidade e manutenção — se tiver um caso concreto, explico como analisamos esforço e riscos.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-automacoes-integracoes';

UPDATE public.crm_email_templates
SET
  label = 'Primeiro contacto — âmbito em aberto',
  area_label = 'Transversal',
  subject_template = 'Flowly | Software pensado para o seu negócio',
  body_template = $body$
A Flowly apoia empresas a digitalizar operações — desde equipas comerciais e logística a restauração, produção ou serviços.

O objetivo é simples: menos retrabalho, mais clareza para quem decide e para quem executa.

Se {{empresa}} está a avaliar dar o próximo passo na digitalização, estamos disponíveis para uma primeira conversa curta e sem compromisso.
$body$
WHERE kind = 'prospeccao' AND slug = 'prospeccao-generico';

SELECT 'crm_prospeccao_copy_updated' AS status;
