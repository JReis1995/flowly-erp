"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { CheckCircle, Sparkles, ArrowRight, Brain, Coins, Loader2 } from "lucide-react";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<{
    pacoteNome: string;
    creditos: number;
    amountTotal: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Animação de confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ["#06B6D4", "#10B981", "#8B5CF6", "#F59E0B"],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ["#06B6D4", "#10B981", "#8B5CF6", "#F59E0B"],
      });
    }, 250);

    // Buscar dados reais da sessão
    async function verifySession() {
      if (!sessionId) {
        setError("ID da sessão não encontrado");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error("Erro ao verificar sessão");
        }

        const data = await response.json();
        
        setSessionData({
          pacoteNome: data.pacoteNome,
          creditos: data.creditos || 0,
          amountTotal: data.amountTotal,
        });
      } catch (err) {
        console.error("Erro:", err);
        setError("Não foi possível verificar a compra");
      } finally {
        setLoading(false);
      }
    }

    verifySession();

    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-16 w-16 text-[#06B6D4] mx-auto mb-4" />
          <p className="text-[#020617] text-lg">A confirmar a tua compra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card Principal */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-r from-[#06B6D4] to-[#10B981] p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
              <Sparkles className="w-8 h-8 text-[#06B6D4]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Compra Confirmada!</h1>
            <p className="text-white/90 mt-1">Obrigado pela tua confiança</p>
          </div>

          {/* Conteúdo */}
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>

            <h2 className="text-xl font-semibold text-[#020617] mb-2">
              {sessionData?.pacoteNome}
            </h2>

            <div className="flex items-center justify-center gap-6 my-6">
              <div className="flex items-center gap-2 text-[#020617]">
                <Brain className="w-5 h-5 text-[#06B6D4]" />
                <span className="font-semibold">{sessionData?.creditos} créditos</span>
              </div>
              <div className="flex items-center gap-2 text-[#020617]">
                <Coins className="w-5 h-5 text-[#10B981]" />
                <span className="font-semibold">{sessionData?.amountTotal.toFixed(2)} €</span>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Os créditos foram adicionados à tua conta e estão prontos a usar!
            </p>

            {/* Botões */}
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full bg-[#06B6D4] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#0891B2] transition-colors"
              >
                Ir para o Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/central-saas/pacotes-ia"
                className="inline-flex items-center justify-center gap-2 w-full bg-white text-[#020617] font-semibold py-3 px-6 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Ver mais Pacotes
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-4 text-center text-sm text-gray-500">
            Receberás um email de confirmação em breve.
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback para Suspense
function CheckoutSuccessFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin h-16 w-16 text-[#06B6D4] mx-auto mb-4" />
        <p className="text-[#020617] text-lg">A carregar...</p>
      </div>
    </div>
  );
}

// Page component com Suspense boundary
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutSuccessFallback />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
