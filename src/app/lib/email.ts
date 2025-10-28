import nodemailer from 'nodemailer';

// Configuration du transporteur email
// Vous pouvez utiliser Gmail, Outlook, ou votre propre serveur SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true pour 465, false pour les autres ports
  auth: {
    user: process.env.SMTP_USER, // votre email
    pass: process.env.SMTP_PASS, // votre mot de passe ou app password
  },
});

export interface SendCallbackEmailParams {
  collaboratorEmail: string;
  collaboratorName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  message: string;
}

export async function sendTestEmail(toEmail: string) {
  const emailContent = `
Bonjour,

Ceci est un email de test envoyé depuis l'assistant vocal Grand Chasseral Immo SA.

Si vous recevez cet email, cela signifie que votre configuration SMTP fonctionne correctement ! ✅

---
Cet email a été généré automatiquement par l'assistant vocal Grand Chasseral Immo SA.
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"Assistant Grand Chasseral Immo" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'TEST EMAIL',
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">🧪 Email de Test</h2>
          <p>Bonjour,</p>
          <p>Ceci est un email de test envoyé depuis l'assistant vocal <strong>Grand Chasseral Immo SA</strong>.</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724;">
              ✅ <strong>Configuration SMTP fonctionnelle !</strong><br>
              Si vous recevez cet email, votre configuration est correcte.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          <p style="font-size: 12px; color: #6c757d;">
            Cet email a été généré automatiquement par l'assistant vocal Grand Chasseral Immo SA.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de test:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

export async function sendCallbackEmail(params: SendCallbackEmailParams) {
  const {
    collaboratorEmail,
    collaboratorName,
    clientName,
    clientPhone,
    clientEmail,
    message,
  } = params;

  const emailContent = `
Bonjour ${collaboratorName},

Vous avez reçu une demande de rappel via l'assistant vocal Grand Chasseral Immo SA.

📋 Informations du client:
- Nom: ${clientName}
- Téléphone: ${clientPhone}
- Email: ${clientEmail}

💬 Message:
${message}

Merci de contacter ce client dans les plus brefs délais.

---
Cet email a été généré automatiquement par l'assistant vocal Grand Chasseral Immo SA.
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"Assistant Grand Chasseral Immo" <${process.env.SMTP_USER}>`,
      to: collaboratorEmail,
      cc: clientEmail, // Copie au client pour confirmation
      subject: `Demande de rappel - ${clientName}`,
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Demande de rappel</h2>
          <p>Bonjour <strong>${collaboratorName}</strong>,</p>
          <p>Vous avez reçu une demande de rappel via l'assistant vocal Grand Chasseral Immo SA.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">📋 Informations du client</h3>
            <p><strong>Nom:</strong> ${clientName}</p>
            <p><strong>Téléphone:</strong> <a href="tel:${clientPhone}">${clientPhone}</a></p>
            <p><strong>Email:</strong> <a href="mailto:${clientEmail}">${clientEmail}</a></p>
          </div>

          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">💬 Message</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>

          <p>Merci de contacter ce client dans les plus brefs délais.</p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          <p style="font-size: 12px; color: #6c757d;">
            Cet email a été généré automatiquement par l'assistant vocal Grand Chasseral Immo SA.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}
