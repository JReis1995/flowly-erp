'use client';

import { useState } from 'react';

export default function TestWebhookPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const simulateWebhook = async () => {
    setLoading(true);
    setResult('');

    try {
      // Simular um evento de webhook do Stripe
      const mockEvent = {
        id: 'evt_test_' + Date.now(),
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_' + Date.now(),
            metadata: {
              tenantId: prompt('ID do tenant:') || '',
              pacoteId: prompt('ID do pacote:') || '',
            },
            amount_total: 999,
            payment_intent: 'pi_test_' + Date.now(),
          },
        },
      };

      const response = await fetch('/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(mockEvent),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult('Erro: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Teste Manual de Webhook</h1>
      <p className="mb-4 text-gray-600">
        Usa isto para simular um pagamento e testar se os créditos são adicionados.
      </p>
      
      <button
        onClick={simulateWebhook}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'A processar...' : 'Simular Pagamento'}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h2 className="font-semibold mb-2">Resultado:</h2>
          <pre className="text-sm overflow-auto">{result}</pre>
        </div>
      )}
    </div>
  );
}
