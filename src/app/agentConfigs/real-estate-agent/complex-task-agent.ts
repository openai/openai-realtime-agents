import { RealtimeAgent, tool } from "@openai/agents/realtime";

export const complexTaskAgent = new RealtimeAgent({
  name: "complexTaskAgent",
  voice: "sage",
  handoffDescription:
    "Gère les demandes complexes ou hors périmètre. Crée une tâche de suivi et envoie un email récapitulatif.",

  instructions: `
Vous êtes un agent d'immobilier. Votre rôle est de traiter les demandes qui dépassent le périmètre des autres agents (questions complexes, cas particuliers, demandes nécessitant l'avis d'un humain).

# Objectifs
- Résumer clairement la demande du client en 2-3 phrases
- Confirmer au client qu'un conseiller humain prendra le relais
- Créer une tâche interne avec un résumé et un niveau de priorité
- Envoyer un email récapitulatif au client avec les prochaines étapes

# Procédure
1. Valider la compréhension de la demande et reformuler en 2-3 phrases
2. Demander l'email du client si non fourni
3. Déterminer une priorité (par défaut: medium)
4. Appeler createTask(summary, details?, priority)
5. Appeler sendEmail(to, subject, body) pour le client
6. Confirmer au client la création de la tâche et l'envoi de l'email

# Important
- Ne créez la tâche que lorsque vous avez un résumé clair
- Ne déclenchez sendEmail que si l'adresse email du client est connue
- Restez concis, professionnel et rassurant
`,

  tools: [
    tool({
      name: "createTask",
      description:
        "Crée une tâche de suivi pour qu'un conseiller humain traite la demande.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Résumé concis (2-3 phrases) de la demande du client",
          },
          details: {
            type: "string",
            description:
              "Détails additionnels utiles pour le conseiller (optionnel)",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Niveau de priorité pour le traitement humain",
          },
        },
        required: ["summary", "priority"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { summary, details, priority } = input as {
          summary: string;
          details?: string;
          priority: "low" | "medium" | "high";
        };
        return {
          taskId: `TASK-${Date.now()}`,
          status: "OPEN",
          priority,
          createdAt: new Date().toISOString(),
          summary,
          details: details ?? null,
        };
      },
    }),

    tool({
      name: "sendEmail",
      description: "Envoie un email récapitulatif au client",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Adresse email du destinataire" },
          subject: { type: "string", description: "Sujet de l'email" },
          body: { type: "string", description: "Contenu de l'email (texte)" },
        },
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { to, subject, body } = input as {
          to: string;
          subject: string;
          body: string;
        };
        return {
          sent: true,
          messageId: `MSG-${Date.now()}`,
          to,
          subject,
          preview: body.slice(0, 80),
        };
      },
    }),
  ],

  handoffs: [],
});
