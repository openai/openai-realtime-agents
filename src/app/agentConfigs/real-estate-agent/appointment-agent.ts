import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const appointmentAgent = new RealtimeAgent({
  name: 'appointmentAgent',
  voice: 'echo',
  handoffDescription:
    "Agent spécialisé dans la prise de rendez-vous avec les conseillers immobiliers. Gère la collecte d'informations et la planification.",

  instructions: `
Vous êtes un assistant de prise de rendez-vous professionnel et organisé.

# Rôle
- Collecter les informations nécessaires pour un rendez-vous
- Proposer des créneaux disponibles
- Confirmer le rendez-vous
- Envoyer une confirmation

# Instructions
- Collectez les informations suivantes dans cet ordre:
  1. Nom et prénom du client
  2. Numéro de téléphone
  3. Email
  4. Type de projet (achat, vente, location)
  5. Préférence de créneau (matin/après-midi, jours préférés)
  
- Utilisez l'outil 'checkAvailability' pour vérifier les disponibilités
- Proposez 2-3 créneaux au client
- Une fois le créneau choisi, utilisez 'bookAppointment' pour confirmer
- Confirmez tous les détails avant de finaliser

# Ton
- Professionnel et organisé
- Patient et méthodique
- Rassurant

# Format de Collecte
Collectez UNE information à la fois. Ne demandez jamais plusieurs informations simultanément.

# Exemple
Assistant: "Parfait ! Pour prendre rendez-vous, j'ai besoin de quelques informations. Pouvez-vous me donner votre nom complet ?"
User: "Jean Dupont"
Assistant: "Merci Jean. Quel est votre numéro de téléphone ?"
User: "06 12 34 56 78"
Assistant: "Parfait. Et votre adresse email ?"
User: "jean.dupont@email.com"
Assistant: "Très bien. Votre projet concerne un achat, une vente ou une location ?"
User: "Un achat"
Assistant: "Excellent. Préférez-vous un rendez-vous le matin ou l'après-midi ? Et quels jours vous arrangent le mieux ?"
User: "Plutôt l'après-midi, en début de semaine"
Assistant: "Laissez-moi vérifier les disponibilités..."
[Uses checkAvailability tool]
Assistant: "J'ai trois créneaux disponibles : lundi 14h, mardi 15h, ou mercredi 14h30. Lequel vous convient le mieux ?"
`,

  tools: [
    tool({
      name: 'checkAvailability',
      description: 'Vérifie les créneaux disponibles pour un rendez-vous.',
      parameters: {
        type: 'object',
        properties: {
          preferredTimeSlot: {
            type: 'string',
            enum: ['morning', 'afternoon', 'any'],
            description: 'Préférence horaire du client',
          },
          preferredDays: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            },
            description: 'Jours préférés du client',
          },
        },
        required: ['preferredTimeSlot'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { preferredTimeSlot } = input as {
          preferredTimeSlot: string;
          preferredDays?: string[];
        };

        const availableSlots = [
          { id: 'slot1', day: 'Lundi', date: '2025-10-27', time: '14:00', advisor: 'Sophie Martin' },
          { id: 'slot2', day: 'Mardi', date: '2025-10-28', time: '15:00', advisor: 'Pierre Dubois' },
          { id: 'slot3', day: 'Mercredi', date: '2025-10-29', time: '14:30', advisor: 'Sophie Martin' },
          { id: 'slot4', day: 'Jeudi', date: '2025-10-30', time: '10:00', advisor: 'Marie Leroy' },
          { id: 'slot5', day: 'Vendredi', date: '2025-10-31', time: '16:00', advisor: 'Pierre Dubois' },
        ];

        let filtered = availableSlots;
        if (preferredTimeSlot === 'morning') {
          filtered = filtered.filter(slot => parseInt(slot.time.split(':')[0]) < 12);
        } else if (preferredTimeSlot === 'afternoon') {
          filtered = filtered.filter(slot => parseInt(slot.time.split(':')[0]) >= 12);
        }

        return {
          availableSlots: filtered.slice(0, 3),
          totalAvailable: filtered.length,
        };
      },
    }),

    tool({
      name: 'bookAppointment',
      description: 'Réserve un créneau de rendez-vous pour le client.',
      parameters: {
        type: 'object',
        properties: {
          slotId: {
            type: 'string',
            description: 'ID du créneau choisi',
          },
          clientName: {
            type: 'string',
            description: 'Nom complet du client',
          },
          phoneNumber: {
            type: 'string',
            description: 'Numéro de téléphone du client',
          },
          email: {
            type: 'string',
            description: 'Email du client',
          },
          projectType: {
            type: 'string',
            enum: ['achat', 'vente', 'location'],
            description: 'Type de projet immobilier',
          },
        },
        required: ['slotId', 'clientName', 'phoneNumber', 'email', 'projectType'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { slotId, clientName, phoneNumber, email, projectType } = input as {
          slotId: string;
          clientName: string;
          phoneNumber: string;
          email: string;
          projectType: string;
        };

        return {
          success: true,
          confirmationNumber: `RDV-${Date.now()}`,
          message: `Rendez-vous confirmé pour ${clientName}`,
          details: {
            slotId,
            clientName,
            phoneNumber,
            email,
            projectType,
          },
          emailSent: true,
        };
      },
    }),
  ],

  handoffs: [],
});
