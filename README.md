
## Setup

### Requisitos
- Node.js >=18 <21.
- Este projeto é uma aplicação Next.js com TypeScript.

### Instalação
- Execute `npm install` para instalar as dependências.

### Configuração do ambiente
- Copie `.env.example` para `.env.local` e preencha as variáveis abaixo:
  - `OPENAI_API_KEY` – chave usada pelo backend.
  - `NEXT_PUBLIC_OPENAI_API_KEY` – chave visível no frontend.
  - `NEXT_PUBLIC_USE_LLM_BACKEND` – quando `true` o backend utiliza o LLM para gerar dados fictícios; nesse caso o diretório `data/` será criado automaticamente para armazenar `llm-benefit-cache.json`.
- Após editar `package.json`, rode `npm install` novamente caso novas dependências (como `encoding`) tenham sido adicionadas.

### Servidor de desenvolvimento
- Inicie com `npm run dev` e acesse [http://localhost:3000](http://localhost:3000). O app conecta automaticamente ao Agent Set `simpleExample`.
- Para testar somente a interface, sem precisar de conexão com a API, use [http://localhost:3000/playground](http://localhost:3000/playground). Esse modo roda offline e serve para experimentos de UI.

### Loan simulator backend
Marlene consome o backend falso em `src/app/loanSimulator`. Rodar `npm run dev` com o Agent Set padrão (`marlene`) utiliza essas funções para simulações de empréstimo e ofertas Itaú.
Com `NEXT_PUBLIC_USE_LLM_BACKEND=true`, o simulador passa a chamar `/api/loan/consult`, gerando dados consistentes via modelo OpenAI. O resultado fica em `data/llm-benefit-cache.json` e o diretório `data/` é criado automaticamente se ainda não existir.

### Persistência de conversa
O endpoint `/api/run-id` retorna um identificador único para cada execução do backend. O frontend salva esse valor junto com o contexto da conversa no `localStorage`. Ao recarregar a página, `rehydrateContext` verifica o run-id atual; se for igual ao salvo, a conversa é retomada de onde parou. Se o backend tiver reiniciado e o run-id mudar, o histórico é apagado automaticamente. Para começar do zero manualmente, utilize `restartConversation()`.

## Testes e lint
- `npm test` executa a suíte Jest.
- `npm run lint` roda o linter do projeto.

## Build para produção
- Gere o build com `npm run build`.
- Em seguida inicie o servidor com `npm start`.

## Integração contínua
Este repositório possui um workflow de CI em `.github/workflows/ci.yml` que instala as dependências,
executa `npm test` e `npm run lint` usando Node.js 18. O fluxo utiliza o cache do `actions/setup-node`
para agilizar as execuções.

Além disso, o workflow `.github/workflows/check-agents.yml` garante que qualquer mudança em arquivos de
código seja acompanhada de uma atualização no `AGENTS.md`. Caso o arquivo de documentação não seja
alterado quando arquivos em `src/` ou `__tests__/` forem modificados, o PR falhará com uma mensagem
orientando a atualizar o `AGENTS.md`.

## Configurando agentes
Escolha um dos arquivos em `src/app/agentConfigs` para definir o comportamento dos agentes ou crie o seu próprio.
O exemplo abaixo mostra a configuração em `src/app/agentConfigs/simpleExample.ts`:
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

### Next steps
- Check out the configs in `src/app/agentConfigs`. The example above is a minimal demo that illustrates the core concepts.
- [frontDeskAuthentication](src/app/agentConfigs/frontDeskAuthentication) Guides the user through a step-by-step authentication flow, confirming each value character-by-character, authenticates the user with a tool call, and then transfers to another agent. Note that the second agent is intentionally "bored" to show how to prompt for personality and tone.
- [customerServiceRetail](src/app/agentConfigs/customerServiceRetail) Also guides through an authentication flow, reads a long offer from a canned script verbatim, and then walks through a complex return flow which requires looking up orders and policies, gathering user context, and checking with `o1-mini` to ensure the return is eligible. To test this flow, say that you'd like to return your snowboard and go through the necessary prompts!

### Definindo seus próprios agentes
- Você pode copiar esses exemplos para criar seu próprio voice app multiagente! Após criar uma nova configuração, adicione-a em `src/app/agentConfigs/index.ts` para que ela apareça no menu "Scenario" da interface.
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

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on documenting your code changes and running the checks. Frequent contributors may want to install the optional pre-commit hook described there.
