import { Resend } from "resend";

const FROM_GENERAL = "geral@flowly.pt";
const FROM_COMERCIAL = "geral@flowly.pt";
const CURRENT_YEAR = new Date().getFullYear();

// Lazy initialization - só cria a instância quando necessário
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY não está definida");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/** URL pública HTTPS — Gmail/Outlook bloqueiam ou ignoram imagens inline data:/base64 */
function getEmailLogoUrl(): string {
  const custom = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL?.trim();
  if (custom) return custom;
  // Logo Flowly ERP via CDN fiável
  return "https://i.postimg.cc/mrcDM13S/flowly-logo.jpg";
}

// Assinatura transversal para todos os emails
const EMAIL_FOOTER = (fromEmail: string) => `
        <div style="background: #F1F5F9; padding: 30px; text-align: center;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #06B6D4 100%); border-radius: 8px; padding: 15px 20px; margin-bottom: 20px; display: inline-block;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="padding-right: 10px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </td>
                <td>
                  <span style="color: #ffffff; font-weight: 700; font-size: 14px; font-family: 'Inter', sans-serif;">Software de Confian&ccedil;a &middot; Portugal</span>
                </td>
              </tr>
            </table>
          </div>
          
          <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0;">
            Flowly ERP - Sistema de Gest&atilde;o Integrado
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            &copy; ${CURRENT_YEAR} Flowly. Todos os direitos reservados.<br/>
            <a href="mailto:${fromEmail}" style="color: #06B6D4;">${fromEmail}</a>
          </p>
        </div>
      </div>
`;

export interface WelcomeEmailData {
  to: string;
  nome: string;
  empresa: string;
  resetPasswordLink?: string;
}

export interface PurchaseThankYouEmailData {
  to: string;
  nome: string;
  pacoteNome: string;
  creditos: number;
  valor: number;
}

/**
 * Enviar email de boas-vindas para novo cliente
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, nome, empresa, resetPasswordLink } = data;

    const html = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #06B6D4 0%, #0891B2 100%); padding: 40px 30px; text-align: center;">
          <!-- Logo Flowly Correto -->
          <div style="margin-bottom: 15px;">
            <span style="color: #ffffff; font-weight: 800; font-size: 42px; font-family: 'Inter', sans-serif; letter-spacing: 2px; font-style: italic; text-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block;">FLOWLY</span>
            <div style="width: 180px; height: 4px; background: linear-gradient(90deg, #10B981 0%, #06B6D4 100%); margin: 8px auto; border-radius: 2px;"></div>
            <span style="color: rgba(255,255,255,0.95); font-weight: 500; font-size: 11px; font-family: 'Inter', sans-serif; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-top: 8px;">Onde o fluxo encontra a precis&atilde;o</span>
          </div>
          <h1 style="color: #ffffff; margin: 20px 0 0 0; font-size: 24px; font-weight: 600;">Bem-vindo &agrave; Flowly!</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #ffffff;">
          <p style="color: #020617; font-size: 18px; margin-bottom: 20px;">Olá ${nome},</p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            É com grande satisfação que damos as boas-vindas à <strong>${empresa}</strong> à família Flowly! 
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            A sua conta está criada e pronta a usar. O Flowly ERP vai revolucionar a gestão do seu negócio 
            com módulos integrados de logística, contabilidade, recursos humanos e muito mais.
          </p>
          
          ${resetPasswordLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetPasswordLink}" 
               style="background: #06B6D4; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Definir Palavra-passe
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 30px;">
            Ou copie este link: ${resetPasswordLink}
          </p>
          ` : ""}
          
          <div style="background: #F8FAFC; border-left: 4px solid #06B6D4; padding: 20px; margin: 30px 0;">
            <h3 style="color: #020617; margin: 0 0 15px 0; font-size: 16px;">Próximos passos:</h3>
            <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Complete o seu perfil de empresa</li>
              <li>Importe os seus dados (clientes, fornecedores, artigos)</li>
              <li>Explore a IA Insight para análises inteligentes</li>
            </ul>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Precisa de ajuda? A nossa equipa de suporte est&aacute; dispon&iacute;vel por email.
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Obrigado por escolher o Flowly!<br/>
            <strong>Equipa Flowly</strong>
          </p>
        </div>
        
        ${EMAIL_FOOTER(FROM_GENERAL)}
    `;

    console.log('Tentando enviar email de boas-vindas...');
    const result = await getResend().emails.send({
      from: `Flowly <${FROM_GENERAL}>`,
      to,
      subject: "Bem-vindo ao Flowly ERP! 🎉",
      html,
    });

    console.log('Resultado Resend:', result);

    if (result.error) {
      console.error("Erro ao enviar email de boas-vindas:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[Email] Boas-vindas enviado para ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao enviar email de boas-vindas:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Enviar email de agradecimento após compra de créditos IA
 */
export async function sendPurchaseThankYouEmail(data: PurchaseThankYouEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, nome, pacoteNome, creditos, valor } = data;

    const html = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #06B6D4 0%, #10B981 100%); padding: 40px 30px; text-align: center;">
          <!-- Logo Flowly Correto -->
          <div style="margin-bottom: 15px;">
            <span style="color: #ffffff; font-weight: 800; font-size: 42px; font-family: 'Inter', sans-serif; letter-spacing: 2px; font-style: italic; text-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block;">FLOWLY</span>
            <div style="width: 180px; height: 4px; background: linear-gradient(90deg, #10B981 0%, #06B6D4 100%); margin: 8px auto; border-radius: 2px;"></div>
            <span style="color: rgba(255,255,255,0.95); font-weight: 500; font-size: 11px; font-family: 'Inter', sans-serif; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-top: 8px;">Onde o fluxo encontra a precis&atilde;o</span>
          </div>
          <h1 style="color: #ffffff; margin: 20px 0 0 0; font-size: 24px; font-weight: 600;">Obrigado pela sua compra!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Cr&eacute;ditos IA adicionados &agrave; sua conta</p>
        </div>
        
        <div style="padding: 40px 30px; background: #ffffff;">
          <p style="color: #020617; font-size: 18px; margin-bottom: 20px;">Olá ${nome},</p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Agradecemos a sua confiança! Os créditos IA foram adicionados à sua conta com sucesso.
          </p>
          
          <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center;">
            <h2 style="color: #10B981; margin: 0 0 20px 0; font-size: 20px;">Resumo da Compra</h2>
            
            <div style="display: inline-block; text-align: left;">
              <div style="margin-bottom: 15px;">
                <span style="color: #64748b; font-size: 14px;">Pacote:</span>
                <span style="color: #020617; font-size: 16px; font-weight: 600; margin-left: 10px;">${pacoteNome}</span>
              </div>
              <div style="margin-bottom: 15px;">
                <span style="color: #64748b; font-size: 14px;">Créditos:</span>
                <span style="color: #10B981; font-size: 24px; font-weight: 700; margin-left: 10px;">${creditos}</span>
              </div>
              <div>
                <span style="color: #64748b; font-size: 14px;">Valor pago:</span>
                <span style="color: #020617; font-size: 16px; font-weight: 600; margin-left: 10px;">€${valor.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ia-insight" 
               style="background: #06B6D4; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Usar Créditos IA
            </a>
          </div>
          
          <div style="background: #F8FAFC; border-left: 4px solid #06B6D4; padding: 20px; margin: 30px 0;">
            <h3 style="color: #020617; margin: 0 0 15px 0; font-size: 16px;">O que pode fazer com IA?</h3>
            <ul style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Análises preditivas de vendas e stock</li>
              <li>Insights automáticos sobre o seu negócio</li>
              <li>Relatórios inteligentes em segundos</li>
              <li>Recomendações personalizadas</li>
            </ul>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Uma fatura foi enviada para o seu email. Se tiver alguma questão, não hesite em contactar-nos.
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Obrigado!<br/>
            <strong>Equipa Flowly</strong>
          </p>
        </div>
        
        ${EMAIL_FOOTER(FROM_COMERCIAL)}
    `;

    console.log('Tentando enviar email de agradecimento...');
    const result = await getResend().emails.send({
      from: `Flowly Comercial <${FROM_COMERCIAL}>`,
      to,
      subject: "Obrigado pela sua compra de Créditos IA! ✨",
      html,
    });

    console.log('Resultado Resend:', result);

    if (result.error) {
      console.error("Erro ao enviar email de agradecimento:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[Email] Agradecimento de compra enviado para ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao enviar email de agradecimento:", error);
    return { success: false, error: error.message };
  }
}
