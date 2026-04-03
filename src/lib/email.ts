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

/** URL do logo - usando domínio próprio para evitar bloqueios */
function getEmailLogoUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://flowly.pt';
  return `${appUrl}/logo.png`;
}

// Estilos globais para compatibilidade com clientes de email
const STYLES = {
  body: `
    margin: 0;
    padding: 0;
    background-color: #f3f4f6;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `,
  container: `
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  `,
  header: `
    background-color: #ffffff;
    padding: 32px;
    text-align: center;
    border-bottom: 1px solid #f3f4f6;
  `,
  logo: `
    width: 150px;
    height: auto;
    display: block;
    margin: 0 auto;
  `,
  content: `
    padding: 40px 32px;
    background-color: #ffffff;
  `,
  heading1: `
    color: #111827;
    margin: 0 0 24px 0;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.3;
  `,
  text: `
    color: #374151;
    font-size: 16px;
    line-height: 1.6;
    margin: 0 0 16px 0;
  `,
  button: `
    background-color: #06B6D4;
    color: #ffffff;
    padding: 14px 32px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    display: inline-block;
    font-size: 15px;
  `,
  buttonContainer: `
    text-align: center;
    margin: 32px 0;
  `,
  infoBox: `
    background-color: #f9fafb;
    border-left: 4px solid #06B6D4;
    padding: 20px;
    margin: 24px 0;
    border-radius: 0 6px 6px 0;
  `,
  successBox: `
    background-color: #f0fdf4;
    border: 2px solid #10B981;
    border-radius: 12px;
    padding: 30px;
    margin: 24px 0;
    text-align: center;
  `,
  footer: `
    background-color: #f9fafb;
    padding: 24px 32px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  `,
  footerText: `
    color: #6b7280;
    font-size: 13px;
    margin: 0 0 8px 0;
  `,
  link: `
    color: #06B6D4;
    text-decoration: none;
  `,
  list: `
    margin: 0;
    padding-left: 20px;
    color: #374151;
    font-size: 15px;
    line-height: 1.8;
  `,
  strong: `
    color: #111827;
    font-weight: 600;
  `,
};

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
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo à Flowly!</title>
</head>
<body style="${STYLES.body}">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="${STYLES.container}">
          <!-- Header -->
          <tr>
            <td style="${STYLES.header}">
              <img src="${getEmailLogoUrl()}" alt="Flowly ERP" style="${STYLES.logo}" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="${STYLES.content}">
              <h1 style="${STYLES.heading1}">Bem-vindo à Flowly!</h1>
              
              <p style="${STYLES.text}">Olá ${nome},</p>
              
              <p style="${STYLES.text}">
                É com grande satisfação que damos as boas-vindas à <strong style="${STYLES.strong}">${empresa}</strong> à família Flowly!
              </p>
              
              <p style="${STYLES.text}">
                A sua conta está criada e pronta a usar. O Flowly ERP vai revolucionar a gestão do seu negócio 
                com módulos integrados de logística, contabilidade, recursos humanos e muito mais.
              </p>
              
              ${resetPasswordLink ? `
              <div style="${STYLES.buttonContainer}">
                <a href="${resetPasswordLink}" style="${STYLES.button}">Definir Palavra-passe</a>
              </div>
              ` : ""}
              
              <div style="${STYLES.infoBox}">
                <h3 style="color: #111827; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Próximos passos:</h3>
                <ul style="${STYLES.list}">
                  <li>Complete o seu perfil de empresa</li>
                  <li>Importe os seus dados (clientes, fornecedores, artigos)</li>
                  <li>Explore a IA Insight para análises inteligentes</li>
                </ul>
              </div>
              
              <p style="${STYLES.text}">
                Precisa de ajuda? A nossa equipa de suporte está disponível por email.
              </p>
              
              <p style="${STYLES.text}">
                Obrigado por escolher o Flowly!<br/>
                <strong style="${STYLES.strong}">Equipa Flowly</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="${STYLES.footer}">
              <p style="${STYLES.footerText}">Flowly ERP - Sistema de Gestão Integrado</p>
              <p style="${STYLES.footerText}">
                © ${CURRENT_YEAR} Flowly. Todos os direitos reservados.<br/>
                <a href="mailto:${FROM_GENERAL}" style="${STYLES.link}">${FROM_GENERAL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const result = await getResend().emails.send({
      from: `Flowly <${FROM_GENERAL}>`,
      to,
      subject: "Bem-vindo ao Flowly ERP! 🎉",
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
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
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Obrigado pela sua compra!</title>
</head>
<body style="${STYLES.body}">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="${STYLES.container}">
          <!-- Header -->
          <tr>
            <td style="${STYLES.header}">
              <img src="${getEmailLogoUrl()}" alt="Flowly ERP" style="${STYLES.logo}" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="${STYLES.content}">
              <h1 style="${STYLES.heading1}">Obrigado pela sua compra!</h1>
              
              <p style="${STYLES.text}">Olá ${nome},</p>
              
              <p style="${STYLES.text}">
                Agradecemos a sua confiança! Os créditos IA foram adicionados à sua conta com sucesso.
              </p>
              
              <div style="${STYLES.successBox}">
                <h2 style="color: #059669; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Resumo da Compra</h2>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; text-align: left;">
                  <tr>
                    <td style="padding: 8px 16px 8px 0; color: #6b7280; font-size: 14px;">Pacote:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 16px; font-weight: 600;">${pacoteNome}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 16px 8px 0; color: #6b7280; font-size: 14px;">Créditos:</td>
                    <td style="padding: 8px 0; color: #10B981; font-size: 24px; font-weight: 700;">${creditos}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 16px 8px 0; color: #6b7280; font-size: 14px;">Valor pago:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 16px; font-weight: 600;">€${valor.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
              
              <div style="${STYLES.buttonContainer}">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/ia-insight" style="${STYLES.button}">Usar Créditos IA</a>
              </div>
              
              <div style="${STYLES.infoBox}">
                <h3 style="color: #111827; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">O que pode fazer com IA?</h3>
                <ul style="${STYLES.list}">
                  <li>Análises preditivas de vendas e stock</li>
                  <li>Insights automáticos sobre o seu negócio</li>
                  <li>Relatórios inteligentes em segundos</li>
                  <li>Recomendações personalizadas</li>
                </ul>
              </div>
              
              <p style="${STYLES.text}">
                Uma fatura foi enviada para o seu email. Se tiver alguma questão, não hesite em contactar-nos.
              </p>
              
              <p style="${STYLES.text}">
                Obrigado!<br/>
                <strong style="${STYLES.strong}">Equipa Flowly</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="${STYLES.footer}">
              <p style="${STYLES.footerText}">Flowly ERP - Sistema de Gestão Integrado</p>
              <p style="${STYLES.footerText}">
                © ${CURRENT_YEAR} Flowly. Todos os direitos reservados.<br/>
                <a href="mailto:${FROM_COMERCIAL}" style="${STYLES.link}">${FROM_COMERCIAL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const result = await getResend().emails.send({
      from: `Flowly Comercial <${FROM_COMERCIAL}>`,
      to,
      subject: "Obrigado pela sua compra de Créditos IA! ✨",
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
