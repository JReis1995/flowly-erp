import Link from "next/link";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card Principal */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
              <XCircle className="w-8 h-8 text-gray-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Compra Cancelada</h1>
            <p className="text-white/90 mt-1">Não te preocupes, não houve cobrança</p>
          </div>

          {/* Conteúdo */}
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-6">
              A compra foi cancelada ou ocorreu um problema durante o processamento. 
              Se precisares de ajuda, contacta a nossa equipa de suporte.
            </p>

            {/* Botões */}
            <div className="space-y-3">
              <Link
                href="/central-saas/pacotes-ia"
                className="inline-flex items-center justify-center gap-2 w-full bg-[#06B6D4] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#0891B2] transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Tentar Novamente
              </Link>

              <Link
                href="/central-saas"
                className="inline-flex items-center justify-center gap-2 w-full bg-white text-[#020617] font-semibold py-3 px-6 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar à Central SaaS
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-4 text-center text-sm text-gray-500">
            Dúvidas? Contacta-nos via <a href="mailto:geral@flowly.pt" className="text-[#06B6D4] hover:underline">geral@flowly.pt</a>
          </div>
        </div>
      </div>
    </div>
  );
}
