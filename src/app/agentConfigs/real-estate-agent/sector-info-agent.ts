import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const sectorInfoAgent = new RealtimeAgent({
  name: 'sectorInfoAgent',
  voice: 'sage',
  handoffDescription:
    "Agent spécialisé dans les informations sur les différents secteurs et quartiers. Fournit des détails sur les prix, commodités, transport, et caractéristiques des quartiers.",

  instructions: `
Vous êtes un expert immobilier spécialisé dans la connaissance des quartiers et secteurs.

# Rôle
- Fournir des informations détaillées sur les différents secteurs
- Répondre aux questions sur les prix moyens, les commodités, les transports
- Aider le client à comprendre les caractéristiques de chaque quartier

# Instructions
- Utilisez l'outil 'getSectorInfo' pour récupérer les informations sur un secteur spécifique
- Présentez les informations de manière claire et structurée
- Mettez en avant les points forts du secteur
- Soyez honnête sur les inconvénients si demandé
- Proposez des quartiers similaires si approprié
- Si le client souhaite ensuite prendre rendez-vous, transférez-le vers 'appointmentAgent'

# Ton
- Expert mais accessible
- Descriptif et précis
- Enthousiaste sans être vendeur

# Format de Réponse
Lorsque vous présentez un secteur:
1. Donnez une vue d'ensemble du quartier
2. Mentionnez le prix moyen
3. Décrivez les commodités principales
4. Parlez des transports
5. Demandez si le client a d'autres questions ou souhaite explorer d'autres secteurs
`,

  tools: [
    tool({
      name: 'getSectorInfo',
      description:
        'Récupère les informations détaillées sur un secteur/quartier spécifique.',
      parameters: {
        type: 'object',
        properties: {
          sectorName: {
            type: 'string',
            description: 'Le nom du secteur ou quartier (ex: Montmartre, Le Marais, 16ème arrondissement)',
          },
        },
        required: ['sectorName'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { sectorName } = input as { sectorName: string };
        
        const sectors: Record<string, any> = {
          'montmartre': {
            name: 'Montmartre',
            arrondissement: '18ème',
            prixMoyenM2: 9500,
            description: 'Quartier bohème et artistique avec vue panoramique sur Paris',
            commodites: ['Sacré-Cœur', 'Place du Tertre', 'Nombreux restaurants et cafés', 'Vignoble de Montmartre'],
            transports: ['Métro ligne 2 (Anvers, Pigalle)', 'Métro ligne 12 (Abbesses)', 'Bus 30, 54, 80'],
            ambiance: 'Touristique mais authentique, vie de village',
            points_forts: ['Vue exceptionnelle', 'Charme historique', 'Vie culturelle riche'],
            points_faibles: ['Très touristique', 'Escaliers nombreux', 'Prix élevés'],
          },
          'le marais': {
            name: 'Le Marais',
            arrondissement: '3ème et 4ème',
            prixMoyenM2: 12500,
            description: 'Quartier historique branché, mélange d\'architecture médiévale et de boutiques modernes',
            commodites: ['Place des Vosges', 'Musée Picasso', 'Boutiques de créateurs', 'Restaurants gastronomiques'],
            transports: ['Métro ligne 1 (Saint-Paul)', 'Métro ligne 8 (Chemin Vert)', 'Bus 29, 69, 76'],
            ambiance: 'Dynamique, cosmopolite, vie nocturne active',
            points_forts: ['Centre de Paris', 'Architecture préservée', 'Vie culturelle intense'],
            points_faibles: ['Très cher', 'Circulation difficile', 'Bruit le week-end'],
          },
          '16ème': {
            name: '16ème arrondissement',
            arrondissement: '16ème',
            prixMoyenM2: 11000,
            description: 'Quartier résidentiel chic et calme, apprécié des familles',
            commodites: ['Bois de Boulogne', 'Trocadéro', 'Écoles internationales', 'Musées (Marmottan, Guimet)'],
            transports: ['Métro ligne 6, 9 (Trocadéro)', 'RER C', 'Bus nombreux'],
            ambiance: 'Calme, résidentiel, familial',
            points_forts: ['Sécurité', 'Espaces verts', 'Écoles réputées', 'Calme'],
            points_faibles: ['Moins animé le soir', 'Prix élevés', 'Éloigné du centre'],
          },
        };

        const normalizedName = sectorName.toLowerCase().trim();
        const sectorInfo = sectors[normalizedName] || sectors[Object.keys(sectors)[0]];

        return {
          found: !!sectors[normalizedName],
          sector: sectorInfo,
          similarSectors: normalizedName in sectors ? [] : ['Montmartre', 'Le Marais', '16ème'],
        };
      },
    }),

    tool({
      name: 'compareSectors',
      description: 'Compare deux secteurs côte à côte pour aider à la décision.',
      parameters: {
        type: 'object',
        properties: {
          sector1: {
            type: 'string',
            description: 'Premier secteur à comparer',
          },
          sector2: {
            type: 'string',
            description: 'Deuxième secteur à comparer',
          },
        },
        required: ['sector1', 'sector2'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { sector1, sector2 } = input as { sector1: string; sector2: string };
        return {
          comparison: `Comparaison entre ${sector1} et ${sector2}`,
          message: 'Fonctionnalité de comparaison détaillée à implémenter',
        };
      },
    }),
  ],

  handoffs: [],
});
