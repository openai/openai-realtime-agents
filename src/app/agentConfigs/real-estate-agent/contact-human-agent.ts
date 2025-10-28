import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { companyInfo } from './constants';

export const contactHumanAgent = new RealtimeAgent({
  name: 'contactHumanAgent',
  voice: 'echo',
  handoffDescription:
    'Gère les demandes de contact avec un collaborateur spécifique. Vérifie la disponibilité et propose des alternatives si nécessaire.',

  instructions: `
Vous êtes l'agent de mise en relation avec les collaborateurs de Grand Chasseral Immo SA.

# Rôle
- Identifier le collaborateur ou le département que le client souhaite contacter
- Vérifier la disponibilité du collaborateur via l'outil 'checkCollaboratorAvailability'
- Transférer l'appel si le collaborateur est disponible
- Proposer d'envoyer un email de rappel si le collaborateur n'est pas disponible ou non-contactable par téléphone

# Procédure
1. Demander le nom du collaborateur ou le département concerné si pas encore clair
2. Utiliser l'outil 'checkCollaboratorAvailability' avec le nom du collaborateur
3. Analyser la réponse:
   - Si disponible (available: true) → "Je vous transfère immédiatement à [Nom]"
   - Si non disponible (available: false) → "Malheureusement, [Nom] n'est pas disponible actuellement. Puis-je vous proposer de lui envoyer un email pour qu'il/elle vous rappelle ? J'aurais besoin de votre nom, numéro de téléphone et un bref message."
   - Si non-contactable (contactable: false) → "[Nom] ne peut pas être joint directement par téléphone. Je vous propose de contacter [escalateTo] ou d'envoyer un email."
4. Si le client accepte l'email, collecter: nom, téléphone, message, puis utiliser l'outil 'sendCallbackRequest'

# Ton
- Professionnel et efficace
- Empathique si le collaborateur n'est pas disponible
- Proposer toujours une solution alternative

# Important
- Ne jamais transférer vers Laurent Carraux ou Luc Bircher (contactableByPhone: false)
- Toujours vérifier la disponibilité avant de promettre un transfert
`,

  tools: [
    tool({
      name: 'checkCollaboratorAvailability',
      description: 'Vérifie si un collaborateur est disponible et contactable par téléphone.',
      parameters: {
        type: 'object',
        properties: {
          collaboratorName: {
            type: 'string',
            description: 'Le nom du collaborateur à contacter (ex: "Julien Bichsel", "Sandy Bircher")',
          },
        },
        required: ['collaboratorName'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { collaboratorName } = input as { collaboratorName: string };
        
        const member = companyInfo.team.find(
          (m) => m.name.toLowerCase().includes(collaboratorName.toLowerCase())
        );

        if (!member) {
          return {
            found: false,
            message: `Aucun collaborateur trouvé avec le nom "${collaboratorName}". Veuillez vérifier l'orthographe ou demander la liste des collaborateurs.`,
          };
        }

        if (!member.contactableByPhone) {
          return {
            found: true,
            contactable: false,
            name: member.name,
            role: member.role,
            escalateTo: member.escalateTo || null,
            message: `${member.name} ne peut pas être contacté directement par téléphone.${member.escalateTo ? ` Veuillez contacter ${member.escalateTo}.` : ''}`,
          };
        }

        const isAvailable = Math.random() > 0.3;

        return {
          found: true,
          contactable: true,
          available: isAvailable,
          name: member.name,
          role: member.role,
          message: isAvailable
            ? `${member.name} est disponible.`
            : `${member.name} n'est pas disponible actuellement.`,
        };
      },
    }),

    tool({
      name: 'sendCallbackRequest',
      description: 'Envoie une demande de rappel par email au collaborateur.',
      parameters: {
        type: 'object',
        properties: {
          collaboratorName: {
            type: 'string',
            description: 'Le nom du collaborateur à qui envoyer la demande',
          },
          clientName: {
            type: 'string',
            description: 'Le nom du client',
          },
          clientPhone: {
            type: 'string',
            description: 'Le numéro de téléphone du client',
          },
          message: {
            type: 'string',
            description: 'Le message ou la raison de l\'appel',
          },
        },
        required: ['collaboratorName', 'clientName', 'clientPhone', 'message'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { collaboratorName, clientName, clientPhone, message } = input as {
          collaboratorName: string;
          clientName: string;
          clientPhone: string;
          message: string;
        };

        return {
          sent: true,
          requestId: `CALLBACK-${Date.now()}`,
          collaborator: collaboratorName,
          client: clientName,
          phone: clientPhone,
          message,
          confirmation: `Votre demande de rappel a été envoyée à ${collaboratorName}. Vous serez contacté au ${clientPhone} dans les plus brefs délais.`,
        };
      },
    }),
  ],

  handoffs: [],
});
