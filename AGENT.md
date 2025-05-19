# Guia de Desenvolvimento

Este projeto é uma aplicação Next.js 15 escrita em TypeScript que demonstra fluxos de agentes de voz usando a OpenAI Realtime API.

## Configuração do Ambiente

### No Codex
Quando executado no Codex:
1. Configure as seguintes variáveis de ambiente através da interface do Codex:
   - OPENAI_API_KEY
   - NEXT_PUBLIC_OPENAI_API_KEY 
   - NEXT_PUBLIC_USE_LLM_BACKEND (opcional, valor padrão: true)
2. Execute o script setup.sh, que detectará automaticamente o ambiente Codex

### Em Desenvolvimento Local
Para desenvolvimento local:
1. Execute o script setup.sh
2. O script criará um arquivo .env.local baseado em .env.example
3. Edite o arquivo .env.local e insira suas chaves de API reais
4. Execute o script setup.sh novamente para completar a configuração

## Estrutura do Projeto
- `src/app/agentConfigs` – Conjuntos de agentes predefinidos e utilitários auxiliares
- `src/app/api` – Rotas de API Next.js (`/session`, `/loan`, `/chat`, etc.)
- `src/app/simple` – Componentes de demonstração de UI autocontidos
- `src/app/loanSimulator` – Lógica usada para simulação de empréstimos
- `public/` – Ativos estáticos e modelos de reconhecimento facial
- `__tests__/` – Testes unitários Jest para módulos-chave

## Requisitos Técnicos
- Node.js 18 (especificado no .nvmrc)
- npm como gerenciador de pacotes
- Chaves de API OpenAI válidas (configuradas conforme instruções acima)

## Comandos Úteis
- `npm run dev` – Inicia o servidor de desenvolvimento
- `npm test` – Executa os testes Jest
- `npm run lint` – Executa o ESLint
- `npm run build` – Compila a aplicação para produção
- `npm start` – Inicia o servidor de produção

## Adicionando ou Modificando Agentes
O comportamento dos agentes é definido em `src/app/agentConfigs`. Atualize
`index.ts` para registrar novos conjuntos de agentes ou altere `defaultAgentSetKey` para
mudar o cenário padrão.

## Notas de Contribuição
- Use TypeScript para todo o novo código
- Mantenha as funções pequenas e documente lógica complexa com comentários
- Execute os testes e o linter antes de fazer commit
- Ativos grandes (como modelos adicionais de reconhecimento facial) devem ser colocados em `public/models`