import { RealtimeAgent, tool } from '@openai/agents-core/realtime';

/*
 * Front-desk authentication flow migrated to the SDK.
 * – authenticationAgent: collects / verifies user details and then hands off.
 * – tourGuideAgent: extremely enthusiastic tour guide.
 *
 * Only one function tool is needed (`authenticateUser`).  For demo purposes the
 * tool simply echoes success – real logic can be swapped in later.
 */

const authenticateUserTool = tool({
  name: 'authenticateUser',
  description:
    'Checks the caller\'s information to authenticate and unlock the ability to access and modify their account information.',
  parameters: {
    type: 'object',
    properties: {
      firstName: { type: 'string', description: "Caller\'s first name" },
      lastName: { type: 'string', description: "Caller\'s last name" },
      dateOfBirth: { type: 'string', description: "Caller\'s date of birth" },
      phoneNumber: { type: 'string', description: "Caller\'s phone number" },
      email: { type: 'string', description: "Caller\'s email address" },
    },
    required: ['firstName', 'lastName', 'dateOfBirth', 'phoneNumber', 'email'],
    additionalProperties: false,
  },
  strict: true,
  async execute(args) {
    console.log('[tool] authenticateUser', args);
    return { authenticated: true };
  },
});

export const fdAuthenticationAgent = new RealtimeAgent({
  name: 'authentication',
  voice: 'ash',
  handoffDescription: 'Front-desk agent that welcomes and verifies caller information.',
  instructions:
    'You are an efficient, polished, and professional front-desk agent. Greet callers, collect and confirm their personal details one by one, then authenticate them via the authenticateUser tool before handing them off to the tour guide.',
  tools: [authenticateUserTool],
  handoffs: [], // filled in below
});

export const tourGuideAgent = new RealtimeAgent({
  name: 'tourGuide',
  voice: 'ash',
  handoffDescription: 'Bubbly and enthusiastic apartment tour guide.',
  instructions:
    "You are a bright and friendly tour guide who can\'t wait to share every detail about the apartment amenities (pool, sauna, cold-plunge, theater, heli-pad, etc.).  Keep the tone quick, peppy and casual, repeating back user details for confirmation when appropriate.",
  tools: [],
  handoffs: [],
});

// Wire hand-offs both directions so either agent can transfer.
fdAuthenticationAgent.handoffs.push(tourGuideAgent);
tourGuideAgent.handoffs.push(fdAuthenticationAgent);

export const frontDeskAuthenticationScenario = [
  fdAuthenticationAgent,
  tourGuideAgent,
];
