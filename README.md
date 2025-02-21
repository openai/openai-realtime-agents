# Realtime API Agents Demo

This is a simple demonstration of more advanced, agentic patterns built on top of the Realtime API. In particular, this demonstrates:
- Sequential agent handoffs according to a defined agent graph (taking inspiration from [OpenAI Swarm](https://github.com/openai/swarm))
- Background escalation to more intelligent models like o1-mini for high-stakes decisions
- Prompting models to follow a state machine, for example to accurately collect things like names and phone numbers with confirmation character by character to authenticate a user.

You should be able to use this repo to prototype your own multi-agent realtime voice app in less than 20 minutes!

![Screenshot of the Realtime API Agents Demo](/public/screenshot.png)

## Setup

- This is a Next.js typescript app
- Install dependencies with `npm i`
- Add your `OPENAI_API_KEY` to your env
- Start the server with `npm run dev`
- Open your browser to [http://localhost:3000](http://localhost:3000) to see the app. It should automatically connect to the `simpleExample` Agent Set.

## Alternative Docker Setup

- You can also run this in a Docker container.
- Build the Docker image with the following command:

  ```bash
  docker build -t realtime-api-agents-demo .
  ```

- Run the Docker container with the following command:

  ```bash
  docker run -it --rm -p 3000:3000 
    -e OPENAI_API_KEY=replace-with-api-key 
    -v local-copy-of/openai-realtime-agents:/app 
    -v /app/node_modules 
    realtime-api-agents-demo
  ```

## Configuring Agents
Configuration in `src/app/agentConfigs/simpleExample.ts`
```javascript
import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

// Define agents
const haiku: AgentConfig = {
  name: "haiku",
  publicDescription: "Agent that writes haikus.", // Context for the agent_transfer tool
  instructions:
    "Ask the user for a topic, then reply with a haiku about that topic.",
  tools: [],
};

const greeter: AgentConfig = {
  name: "greeter",
  publicDescription: "Agent that greets the user.",
  instructions:
    "Please greet the user and ask them if they'd like a Haiku. If yes, transfer them to the 'haiku' agent.",
  tools: [],
  downstreamAgents: [haiku],
};

// add the transfer tool to point to downstreamAgents
const agents = injectTransferTools([greeter, haiku]);

export default agents;
```

This fully specifies the agent set that was used in the interaction shown in the screenshot above.

### Sequence Diagram

#### SimpleExample Flow

This diagram illustrates the interaction flow defined in `src/app/agentConfigs/simpleExample.ts`.

```mermaid
sequenceDiagram
    participant User
    participant WebClient as Next.js Client (App.tsx)
    participant NextAPI as /api/session
    participant RealtimeAPI as OpenAI Realtime API
    participant AgentManager as AgentConfig (greeter, haiku)
    
    Note over WebClient: User navigates to the app with ?agentConfig=simpleExample
    User->>WebClient: Open Page (Next.js SSR fetches page.tsx/layout.tsx)
    WebClient->>WebClient: useEffect loads agent configs (simpleExample)
    WebClient->>WebClient: connectToRealtime() called
    
    Note right of WebClient: Fetch ephemeral session
    WebClient->>NextAPI: GET /api/session
    NextAPI->>RealtimeAPI: POST /v1/realtime/sessions
    RealtimeAPI->>NextAPI: Returns ephemeral session token
    NextAPI->>WebClient: Returns ephemeral token (JSON)
    
    Note right of WebClient: Start RTC handshake
    WebClient->>RealtimeAPI: POST /v1/realtime?model=gpt-4o-realtime-preview-2024-12-17 <Offer SDP>
    RealtimeAPI->>WebClient: Returns SDP answer
    WebClient->>WebClient: DataChannel "oai-events" established
    
    Note over WebClient: The user speaks or sends text
    User->>WebClient: "Hello!" (mic or text)
    WebClient->>AgentManager: conversation.item.create (role=user)
    WebClient->>RealtimeAPI: data channel event: {type: "conversation.item.create"}
    WebClient->>RealtimeAPI: data channel event: {type: "response.create"}
    
    Note left of AgentManager: Agents parse user message
    AgentManager->>greeter: "greeter" sees new user message
    greeter->>AgentManager: Potentially calls "transferAgents(haiku)" if user says "Yes"
    AgentManager-->>WebClient: event: transferAgents => destination_agent="haiku"
    
    Note left of WebClient: data channel function call
    WebClient->>WebClient: handleFunctionCall: sets selectedAgentName="haiku"
    
    Note left of AgentManager: "haiku" agent now handles user messages
    haiku->>AgentManager: Respond with a haiku
    AgentManager->>WebClient: "Here is a haiku…" (assistant role)
    WebClient->>User: Display/Play final answer
```

#### FrontDeskAuthentication Flow

This diagram illustrates the interaction flow defined in `src/app/agentConfigs/frontDeskAuthentication/`.

```mermaid
sequenceDiagram
    participant User
    participant WebClient as Next.js Client (App.tsx)
    participant NextAPI as /api/session
    participant RealtimeAPI as OpenAI Realtime API
    participant AgentManager as Agents (authenticationAgent, tourGuide)

    Note over WebClient: User navigates to ?agentConfig=frontDeskAuthentication
    User->>WebClient: Open Page
    WebClient->>NextAPI: GET /api/session
    NextAPI->>RealtimeAPI: POST /v1/realtime/sessions
    RealtimeAPI->>NextAPI: Returns ephemeral session
    NextAPI->>WebClient: Returns ephemeral token (JSON)

    Note right of WebClient: Start RTC handshake
    WebClient->>RealtimeAPI: Offer SDP (WebRTC)
    RealtimeAPI->>WebClient: SDP answer
    WebClient->>WebClient: DataChannel "oai-events" established

    Note over WebClient,AgentManager: The user is connected to "authenticationAgent" first
    User->>WebClient: "Hello, I need to check in."
    WebClient->>AgentManager: conversation.item.create (role=user)
    WebClient->>RealtimeAPI: data channel event: {type: "conversation.item.create"}
    WebClient->>RealtimeAPI: data channel event: {type: "response.create"}

    Note over AgentManager: authenticationAgent prompts for user details
    authenticationAgent->>AgentManager: calls authenticate_user_information() (tool function)
    AgentManager-->>WebClient: function_call => name="authenticate_user_information"
    WebClient->>WebClient: handleFunctionCall => possibly calls your custom backend or a mock to confirm

    Note left of AgentManager: Once user is authenticated
    authenticationAgent->>AgentManager: calls transferAgents("tourGuide")
    AgentManager-->>WebClient: function_call => name="transferAgents" args={destination: "tourGuide"}

    WebClient->>WebClient: setSelectedAgentName("tourGuide")
    Note over AgentManager: "tourGuide" welcomes the user with a friendly introduction
    tourGuide->>AgentManager: "Here's a guided tour..."
    AgentManager->>WebClient: conversation.item.create (assistant role)
    WebClient->>User: Displays or plays back the tour content
```

#### CustomerServiceRetail Flow

This diagram illustrates the interaction flow defined in `src/app/agentConfigs/customerServiceRetail/`.

```mermaid
sequenceDiagram
    participant User
    participant WebClient as Next.js Client
    participant NextAPI as /api/session
    participant RealtimeAPI as OpenAI Realtime API
    participant AgentManager as Agents (authentication, returns, sales, simulatedHuman)
    participant o1mini as "o1-mini" (Escalation Model)

    Note over WebClient: User navigates to ?agentConfig=customerServiceRetail
    User->>WebClient: Open Page
    WebClient->>NextAPI: GET /api/session
    NextAPI->>RealtimeAPI: POST /v1/realtime/sessions
    RealtimeAPI->>NextAPI: Returns ephemeral session
    NextAPI->>WebClient: Returns ephemeral token (JSON)

    Note right of WebClient: Start RTC handshake
    WebClient->>RealtimeAPI: Offer SDP (WebRTC)
    RealtimeAPI->>WebClient: SDP answer
    WebClient->>WebClient: DataChannel "oai-events" established

    Note over AgentManager: Default agent is "authentication"
    User->>WebClient: "Hi, I'd like to return my snowboard."
    WebClient->>AgentManager: conversation.item.create (role=user)
    WebClient->>RealtimeAPI: {type: "conversation.item.create"}
    WebClient->>RealtimeAPI: {type: "response.create"}

    authentication->>AgentManager: Requests user info, calls authenticate_user_information()
    AgentManager-->>WebClient: function_call => name="authenticate_user_information"
    WebClient->>WebClient: handleFunctionCall => verifies details

    Note over AgentManager: After user is authenticated
    authentication->>AgentManager: transferAgents("returns")
    AgentManager-->>WebClient: function_call => name="transferAgents" args={ destination: "returns" }
    WebClient->>WebClient: setSelectedAgentName("returns")

    Note over returns: The user wants to process a return
    returns->>AgentManager: function_call => checkEligibilityAndPossiblyInitiateReturn
    AgentManager-->>WebClient: function_call => name="checkEligibilityAndPossiblyInitiateReturn"

    Note over WebClient: The WebClient calls /api/chat/completions with model="o1-mini"
    WebClient->>o1mini: "Is this item eligible for return?"
    o1mini->>WebClient: "Yes/No (plus notes)"

    Note right of returns: Returns uses the result from "o1-mini"
    returns->>AgentManager: "Return is approved" or "Return is denied"
    AgentManager->>WebClient: conversation.item.create (assistant role)
    WebClient->>User: Displays final verdict
```

### Next steps
- Check out the configs in `src/app/agentConfigs`. The example above is a minimal demo that illustrates the core concepts.
- [frontDeskAuthentication](src/app/agentConfigs/frontDeskAuthentication) Guides the user through a step-by-step authentication flow, confirming each value character-by-character, authenticates the user with a tool call, and then transfers to another agent. Note that the second agent is intentionally "bored" to show how to prompt for personality and tone.
- [customerServiceRetail](src/app/agentConfigs/customerServiceRetail) Also guides through an authentication flow, reads a long offer from a canned script verbatim, and then walks through a complex return flow which requires looking up orders and policies, gathering user context, and checking with `o1-mini` to ensure the return is eligible. To test this flow, say that you'd like to return your snowboard and go through the necessary prompts!

### Defining your own agents
- You can copy these to make your own multi-agent voice app! Once you make a new agent set config, add it to `src/app/agentConfigs/index.ts` and you should be able to select it in the UI in the "Scenario" dropdown menu.
- To see how to define tools and toolLogic, including a background LLM call, see [src/app/agentConfigs/customerServiceRetail/returns.ts](src/app/agentConfigs/customerServiceRetail/returns.ts)
- To see how to define a detailed personality and tone, and use a prompt state machine to collect user information step by step, see [src/app/agentConfigs/frontDeskAuthentication/authentication.ts](src/app/agentConfigs/frontDeskAuthentication/authentication.ts)
- To see how to wire up Agents into a single Agent Set, see [src/app/agentConfigs/frontDeskAuthentication/index.ts](src/app/agentConfigs/frontDeskAuthentication/index.ts)
- If you want help creating your own prompt using these conventions, we've included a metaprompt [here](src/app/agentConfigs/voiceAgentMetaprompt.txt), or you can use our [Voice Agent Metaprompter GPT](https://chatgpt.com/g/g-678865c9fb5c81918fa28699735dd08e-voice-agent-metaprompt-gpt)

## UI
- You can select agent scenarios in the Scenario dropdown, and automatically switch to a specific agent with the Agent dropdown.
- The conversation transcript is on the left, including tool calls, tool call responses, and agent changes. Click to expand non-message elements.
- The event log is on the right, showing both client and server events. Click to see the full payload.
- On the bottom, you can disconnect, toggle between automated voice-activity detection or PTT, turn off audio playback, and toggle logs.

## Core Contributors
- Noah MacCallum - [noahmacca](https://x.com/noahmacca)
- Ilan Bigio - [ibigio](https://github.com/ibigio)
