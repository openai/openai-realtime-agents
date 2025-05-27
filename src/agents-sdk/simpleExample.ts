import {
  RealtimeAgent,
  tool,
} from '@openai/agents-core/realtime';

/*
 * Migration of the original `simpleExample` scenario to the new SDK.
 * Only custom tool is `transferAgents`, which is now a handoff.
 */

// Forward declaration because greeter references haikuWriter and vice-versa for typing.
export const haikuWriterAgent = new RealtimeAgent({
  name: 'haikuWriter',
  voice: 'ash',
  instructions:
    'Ask the user for a topic, then reply with a haiku about that topic.',
  handoffs: [],
  tools: [],
  handoffDescription: 'Agent that writes haikus',
});

export const greeterAgent = new RealtimeAgent({
  name: 'greeter',
  voice: 'ash',
  instructions:
    "Please greet the user and ask them if they'd like a Haiku. If yes, transfer them to the 'haiku' agent.",
  handoffs: [haikuWriterAgent],
  tools: [],
  handoffDescription: 'Agent that greets the user',
});

// After definitions, push handoff back for completeness (haiku back to greeter? Not required).

export const simpleExampleScenario = [greeterAgent, haikuWriterAgent];
