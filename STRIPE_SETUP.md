# Configuração Stripe - Flowly ERP

## Variáveis de Ambiente Necessárias

Adiciona estas variáveis ao teu `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51T9lao0RobXC8vOB29DuEx8MS95YJL7KwKoMRQZR36uXxlOsYKRBRBgcd5gjhvRns8FNAw5aO2JF1E9iDTy7uyyV00bGd4Qt81
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Configuração Webhook Stripe

1. Acede ao Stripe Dashboard > Developers > Webhooks
2. Adiciona endpoint: `https://tudominio.com/api/stripe/webhook`
3. Seleciona evento: `checkout.session.completed`
4. Copia o signing secret para `STRIPE_WEBHOOK_SECRET`

## Testar Checkout

1. Cria um pacote IA com o campo "Link de Pagamento" preenchido com um Price ID do Stripe (ex: `price_1XYZ...`)
2. Clica no botão 🛒 na tabela de pacotes
3. Completa o checkout com cartão de teste: `4242 4242 4242 4242`

## Estrutura Criada

```
src/
├── app/
│   ├── api/stripe/
│   │   ├── checkout-session/route.ts    # Cria sessão de checkout
│   │   ├── webhook/route.ts              # Recebe eventos Stripe
│   │   └── verify-session/route.ts     # Verifica sessão (opcional)
│   ├── checkout/
│   │   ├── success/page.tsx              # Página de sucesso com confetti
│   │   └── cancel/page.tsx               # Página de cancelamento
│   └── central-saas/
│       └── _actions/stripe.ts            # Server actions
├── lib/
│   └── stripe.ts                         # Configuração Stripe
└── supabase/migrations/
    └── 20250401_stripe_integration.sql   # Tabelas webhook_logs e purchases
```

## Funcionalidades Implementadas

✅ API Route para criar checkout session
✅ Webhook handler para `checkout.session.completed`
✅ Atualização automática de créditos do tenant
✅ Registo de compras na tabela `purchases`
✅ Página de sucesso com animação confetti
✅ Página de cancelamento
✅ Botão "Comprar" na tabela de pacotes
