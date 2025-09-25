import { RealtimeAgent, tool } from '@openai/agents/realtime';

export const authenticationAgent = new RealtimeAgent({
  name: 'authentication',
  voice: 'sage',
  handoffDescription:
    'Greets the user, performs authentication, and routes to downstream agents.',
  instructions:
    'You are an authentication agent. Keep this minimal placeholder version.',
  tools: [
    tool({
      name: 'authenticate_user_information',
      description: 'Verify user info.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string' },
          last_4_digits: { type: 'string' },
          last_4_digits_type: { type: 'string', enum: ['credit_card', 'ssn'] },
          date_of_birth: { type: 'string' },
        },
        required: [
          'phone_number',
          'date_of_birth',
          'last_4_digits',
          'last_4_digits_type',
        ],
        additionalProperties: false,
      },
      execute: async () => ({ success: true }),
    }),
  ],
  handoffs: [],
});
