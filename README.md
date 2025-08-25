### Prosper AI: A Conversational Wealth Coach

**Prosper AI** is a real-time, voice-first personal wealth coaching application. It empowers users to understand their financial health through a conversational interface powered by a two-agent AI system. By simply talking to the AI, users can receive an instant analysis of their finances, a personalized action plan, and a visual dashboard to track their progress.

#### Key Features (MVP)

  * **Real-time Voice Conversation:** Seamless, two-way audio interaction with an AI financial coach.
  * **Tiered Data Collection:** Gathers essential financial data points (income, expenses, savings, debt) through a natural, question-based flow.
  * **Automated Financial Analysis:** Calculates core KPIs (e.g., Spend-to-Income Ratio, Emergency Fund Months) to assess financial health.
  * **Pillar-Based Scoring:** Assigns a score and "Prosper Level" based on five key pillars: Spend, Save, Borrow, Protect, and Grow.
  * **Personalized Action Plan:** Generates a prioritized, 30-day action plan focused on the user's lowest-scoring ("gating") pillar.
  * **Data Visualization:** Presents all financial data, KPIs, pillar scores, and recommendations on a clean, user-friendly dashboard.
  * **Persistent Data:** Saves a snapshot of the user's financial state to a database for a persistent, anonymous experience.

-----

### Technical Architecture

The application uses a **Chat-Supervisor pattern** to balance low-latency conversation with powerful analytical capabilities.

  * **Chat Agent:** A lightweight, real-time agent handles the conversational flow and user interactions.
  * **Supervisor Agent:** A more powerful, analytical agent (like `GPT-4`) is invoked by the Chat Agent to perform complex calculations and generate advice using specialized tools.
  * **Domain Tools:** Core financial logic (KPI calculation, level assignment, recommendation generation) is encapsulated in deterministic functions that the Supervisor Agent can call.

This architecture ensures a smooth, responsive user experience while providing sophisticated financial analysis in the background.

-----

### Technology Stack

  * **Frontend:** Next.js 15, React 19, Tailwind CSS
  * **AI & Voice:** OpenAI Realtime API, OpenAI Agents SDK
  * **Database:** Supabase (PostgreSQL)
  * **Deployment:** Vercel (recommended)

-----

### Getting Started (MVP Setup Guide)

Follow these steps to get the application up and running locally.

#### 1\. Set Up Environment Variables

Create a new file named `.env` in the root of your project and add your credentials.

```
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### 2\. Configure Your Supabase Database

Create the following three tables in your Supabase project using the Table Editor.

**`households`**

  * `id` (uuid, primary key, default: `uuid_generate_v4()`)
  * `created_at` (timestamptz, default: `now()`)

**`snapshots`**

  * `id` (uuid, primary key, default: `uuid_generate_v4()`)
  * `created_at` (timestamptz, default: `now()`)
  * `household_id` (uuid, foreign key to `households.id`)
  * `inputs` (jsonb)
  * `kpis` (jsonb)
  * `levels` (jsonb)
  * `recommendations` (jsonb)
  * `provisional_keys` (text[])

**`net_worth_points`**

  * `id` (bigint, primary key, identity)
  * `household_id` (uuid, foreign key to `households.id`)
  * `ts` (timestamptz, default: `now()`)
  * `value` (numeric)

#### 3\. Install Dependencies and Run

From your terminal, navigate to the project directory and run the following commands:

```bash
# Install all required packages
npm install

# Start the development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

# Realtime API Agents Demo

This is a demonstration of more advanced patterns for voice agents, using the OpenAI Realtime API and the OpenAI Agents SDK. 

## About the OpenAI Agents SDK

This project uses the [OpenAI Agents SDK](https://github.com/openai/openai-agents-js), a toolkit for building, managing, and deploying advanced AI agents. The SDK provides:

- A unified interface for defining agent behaviors and tool integrations.
- Built-in support for agent orchestration, state management, and event handling.
- Easy integration with the OpenAI Realtime API for low-latency, streaming interactions.
- Extensible patterns for multi-agent collaboration, handoffs, tool use, and guardrails.

For full documentation, guides, and API references, see the official [OpenAI Agents SDK Documentation](https://github.com/openai/openai-agents-js#readme).

**NOTE:** For a version that does not use the OpenAI Agents SDK, see the [branch without-agents-sdk](https://github.com/openai/openai-realtime-agents/tree/without-agents-sdk).

The main pattern demonstrated:
1. **Chat-Supervisor:** A realtime-based chat agent interacts with the user and handles basic tasks, while a more intelligent, text-based supervisor model (e.g., `gpt-4.1`) is used extensively for tool calls and more complex responses. This approach provides an easy onramp and high-quality answers, with a small increase in latency.

## Setup

- This is a Next.js typescript app. Install dependencies with `npm i`.
- Add your `OPENAI_API_KEY` to your env. Either add it to your `.bash_profile` or equivalent, or copy `.env.sample` to `.env` and add it there.
- Start the server with `npm run dev`
- Open your browser to [http://localhost:3000](http://localhost:3000). It should default to the `chatSupervisor` Agent Config.

# Agentic Pattern 1: Chat-Supervisor

This is demonstrated in the [chatSupervisor](src/app/agentConfigs/chatSupervisor/index.ts) Agent Config. The chat agent uses the realtime model to converse with the user and handle basic tasks, like greeting the user, casual conversation, and collecting information, and a more intelligent, text-based supervisor model (e.g. `gpt-4.1`) is used extensively to handle tool calls and more challenging responses. You can control the decision boundary by "opting in" specific tasks to the chat agent as desired.

Video walkthrough: [https://x.com/noahmacca/status/1927014156152058075](https://x.com/noahmacca/status/1927014156152058075)

## Example
![Screenshot of the Chat Supervisor Flow](/public/screenshot_chat_supervisor.png)
*In this exchange, note the immediate response to collect the phone number, and the deferral to the supervisor agent to handle the tool call and formulate the response. There ~2s between the end of "give me a moment to check on that." being spoken aloud and the start of the "Thanks for waiting. Your last bill...".*

## Schematic
```mermaid
sequenceDiagram
    participant User
    participant ChatAgent as Chat Agent<br/>(gpt-4o-realtime-mini)
    participant Supervisor as Supervisor Agent<br/>(gpt-4.1)
    participant Tool as Tool

    alt Basic chat or info collection
        User->>ChatAgent: User message
        ChatAgent->>User: Responds directly
    else Requires higher intelligence and/or tool call
        User->>ChatAgent: User message
        ChatAgent->>User: "Let me think"
        ChatAgent->>Supervisor: Forwards message/context
        alt Tool call needed
            Supervisor->>Tool: Calls tool
            Tool->>Supervisor: Returns result
        end
        Supervisor->>ChatAgent: Returns response
        ChatAgent->>User: Delivers response
    end
```

## Benefits
- **Simpler onboarding.** If you already have a performant text-based chat agent, you can give that same prompt and set of tools to the supervisor agent, and make some tweaks to the chat agent prompt, you'll have a natural voice agent that will perform on par with your text agent.
- **Simple ramp to a full realtime agent**: Rather than switching your whole agent to the realtime api, you can move one task at a time, taking time to validate and build trust for each before deploying to production.
- **High intelligence**: You benefit from the high intelligence, excellent tool calling and instruction following of models like `gpt-4.1` in your voice agents.
- **Lower cost**: If your chat agent is only being used for basic tasks, you can use the realtime-mini model, which, even when combined with GPT-4.1, should be cheaper than using the full 4o-realtime model.
- **User experience**: It's a more natural conversational experience than using a stitched model architecture, where response latency is often 1.5s or longer after a user has finished speaking. In this architecture, the model responds to the user right away, even if it has to lean on the supervisor agent.
  - However, more assistant responses will start with "Let me think", rather than responding immediately with the full response.

## Modifying for your own agent
1. Update [supervisorAgent](src/app/agentConfigs/chatSupervisorDemo/supervisorAgent.ts).
  - Add your existing text agent prompt and tools if you already have them. This should contain the "meat" of your voice agent logic and be very specific with what it should/shouldn't do and how exactly it should respond. Add this information below `==== Domain-Specific Agent Instructions ====`.
  - You should likely update this prompt to be more appropriate for voice, for example with instructions to be concise and avoiding long lists of items.
2. Update [chatAgent](src/app/agentConfigs/chatSupervisor/index.ts).
  - Customize the chatAgent instructions with your own tone, greeting, etc.
  - Add your tool definitions to `chatAgentInstructions`. We recommend a brief yaml description rather than json to ensure the model doesn't get confused and try calling the tool directly.
  - You can modify the decision boundary by adding new items to the `# Allow List of Permitted Actions` section.
3. To reduce cost, try using `gpt-4o-mini-realtime` for the chatAgent and/or `gpt-4.1-mini` for the supervisor model. To maximize intelligence on particularly difficult or high-stakes tasks, consider trading off latency and adding chain-of-thought to your supervisor prompt, or using an additional reasoning model-based supervisor that uses `o4-mini`.

# Other Info
## Next Steps
- You can copy these templates to make your own multi-agent voice app! Once you make a new agent set config, add it to `src/app/agentConfigs/index.ts` and you should be able to select it in the UI in the "Scenario" dropdown menu.
- Each agentConfig can define instructions, tools, and toolLogic. By default all tool calls simply return `True`, unless you define the toolLogic, which will run your specific tool logic and return an object to the conversation (e.g. for retrieved RAG context).
- If you want help creating your own prompt using the conventions shown in customerServiceRetail, including defining a state machine, we've included a metaprompt [here](src/app/agentConfigs/voiceAgentMetaprompt.txt), or you can use our [Voice Agent Metaprompter GPT](https://chatgpt.com/g/g-678865c9fb5c81918fa28699735dd08e-voice-agent-metaprompt-gpt)

## Output Guardrails
Assistant messages are checked for safety and compliance before they are shown in the UI.  The guardrail call now lives directly inside `src/app/App.tsx`: when a `response.text.delta` stream starts we mark the message as **IN_PROGRESS**, and once the server emits `guardrail_tripped` or `response.done` we mark the message as **FAIL** or **PASS** respectively.  If you want to change how moderation is triggered or displayed, search for `guardrail_tripped` inside `App.tsx` and tweak the logic there.