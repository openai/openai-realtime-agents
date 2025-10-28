import { RealtimeAgent, tool } from "@openai/agents/realtime";

export const sendTestMailAgent = new RealtimeAgent({
  name: "sendTestMailAgent",
  voice: "echo",
  handoffDescription:
    "Agent de test pour envoyer un email de test à aurelien.borst@gmail.com. Utilisé uniquement pour tester la configuration SMTP.",

  instructions: `
Vous êtes un agent de test pour l'envoi d'emails.

# Rôle
- Envoyer un email de test à aurelien.borst@gmail.com avec le sujet "TEST EMAIL"
- Confirmer l'envoi ou signaler une erreur

# Procédure
1. Dès que vous êtes activé, dites: "Je vais envoyer un email de test..." puis utilisez IMMÉDIATEMENT l'outil 'sendTestEmail'
2. Après l'exécution de l'outil, annoncez le résultat:
   - Si succès: "✅ Email de test envoyé avec succès à aurelien.borst@gmail.com ! Vérifiez votre boîte de réception."
   - Si échec: "❌ Erreur lors de l'envoi de l'email de test: [détails de l'erreur]. Vérifiez votre configuration SMTP dans le fichier .env"

# Ton
- Direct et technique
- Factuel
- Utilisez des emojis pour clarifier le résultat (✅ ou ❌)
`,

  tools: [
    tool({
      name: "sendTestEmail",
      description: "Envoie un email de test à aurelien.borst@gmail.com",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async () => {
        try {
          const response = await fetch('/api/send-test-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const result = await response.json();

          if (response.ok && result.success) {
            return {
              success: true,
              messageId: result.messageId,
              message: "Email de test envoyé avec succès à aurelien.borst@gmail.com",
            };
          } else {
            return {
              success: false,
              error: result.error || 'Erreur inconnue',
              message: `Échec de l'envoi: ${result.error || 'Erreur inconnue'}`,
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Erreur réseau',
            message: `Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          };
        }
      },
    }),
  ],

  handoffs: [],
});
