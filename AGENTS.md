# Documentação dos Agentes

## Introdução
Este projeto é mantido principalmente por um colaborador sem formação formal em desenvolvimento. Este arquivo serve para acumular o conhecimento adquirido sobre o código e registrar sua evolução. Para isso existe a subseção **O que mudou recentemente**, que lista de forma cronológica as alterações mais relevantes.

## Visão Geral
Este repositório contém uma aplicação demo que simula um atendimento de crédito consignado via voz. A pasta `src/app/simple` apresenta a interface web utilizada durante a conversa e toda a lógica voltada para a agente **Marlene**.

Marlene é um agente de voz configurado em `src/app/agentConfigs/marlene.ts`. Ela interage em português, com fala pausada e linguagem extremamente simples para atender principalmente idosos com baixa literacia digital. O comportamento dela envolve uma máquina de estados conversacional, ferramentas próprias e um backend de simulação de empréstimos.

## O que mudou recentemente
- Julho/2024: adicionada opcao de pre-commit hook com testes e lint.
- Junho/2024: adicionadas orientacoes de contribuicao em CONTRIBUTING.md.
- Maio/2024: projeto iniciado como demonstração do agente Marlene e fluxo de concessão de crédito consignado.


## Principais Arquivos
- `src/app/agentConfigs/marlene.ts` – define a personalidade de Marlene, suas ferramentas e como cada chamada de ferramenta processa a conversa.
- `src/app/agentConfigs/utils.ts` – contém o contexto global da conversa, extração de entidades e funções para avançar a máquina de estados.
- `src/app/loanSimulator/index.ts` – backend falso que gera dados de benefício e simulações de empréstimo.
- `src/app/simple/machines/verificationMachine.ts` – máquina de estados para a verificação facial via câmera.

## Máquina de Estados da Conversa
O fluxo da conversa é guiado por nove estados principais. A cada mensagem do usuário, `processUserInputAsync` extrai entidades (nome, número de benefício, valor desejado etc.) e `determineRecommendedState` decide para qual estado seguir.

1. **1_greeting** – Marlene cumprimenta e começa a entender a necessidade do cliente.
2. **2_identify_need** – coleta nome, forma de tratamento preferida e finalidade do empréstimo.
3. **4_benefit_verification** – confirma o número do benefício e consulta limites.
4. **5_camera_verification** – verifica identidade por câmera antes de simular valores.
5. **6_loan_simulation** – apresenta opções de empréstimo conforme os dados coletados.
6. **7_understanding_check** – usa `verify_understanding` para garantir que o cliente compreendeu as condições.
7. **8_confirmation** – registra a intenção de contratar e gera documentação acessível.
8. **9_closing** – encerra o atendimento de forma cordial.
9. **10_early_exit** – caminho para quando o usuário desiste ou não tem interesse.

`recordStateChange` persiste cada transição no contexto global (em `utils.ts`), permitindo retomar a conversa de onde parou se necessário. A função `resetConversationContext` restaura o estado inicial (`1_greeting`).

## Ferramentas Disponíveis
Marlene utiliza várias ferramentas declaradas em `marlene.ts`:
- **animate_loan_value** – destaca valores de empréstimo na interface.
- **open_camera** / **close_camera** – controla a câmera para verificação de identidade.
- **verify_understanding** – avalia se o cliente entendeu o impacto do empréstimo.
- **simplify_financial_explanation** – traduz conceitos complexos para analogias simples.
- **consult_benefit** – consulta limites de benefício no backend simulado.
- **create_accessible_documentation** – gera um resumo (áudio, SMS ou impresso) para o cliente.

A lógica de cada ferramenta fica em `toolLogic` dentro do próprio `marlene.ts`.

## Verificação por Câmera
A verificação facial é controlada por `verificationMachine.ts`, uma máquina de estados XState independente. O fluxo é `idle → preparing → analyzing → verifying → completed`, com transições para `failed` em caso de erro ou se o tempo exceder 15 s em qualquer estágio inicial.

## Backend de Empréstimo
O arquivo `loanSimulator/index.ts` gera dados fictícios de benefício e simulações. Quando a variável de ambiente `NEXT_PUBLIC_USE_LLM_BACKEND=true` é definida, o simulador passa a chamar `/api/loan/consult`, onde um modelo de linguagem produz respostas mais detalhadas e consistentes. Os resultados são armazenados em `data/llm-benefit-cache.json` para reutilização.

## Executando o Projeto
Crie um arquivo `.env.local` com as chaves da OpenAI e demais variáveis:
```
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
NEXT_PUBLIC_USE_LLM_BACKEND=true
```
Instale as dependências e execute em modo de desenvolvimento:
```
npm install
npm run dev
```
A aplicação estará disponível em `http://localhost:3000/`.

Para garantir a qualidade, use:
```
npm test      # executa a suíte Jest
npm run lint  # verifica o código com eslint
```

Com esta estrutura, Marlene conduz o usuário por todo o processo de crédito consignado de maneira humanizada, utilizando a máquina de estados e o backend de simulação para fornecer respostas coerentes mesmo sem conexão real com sistemas bancários.
