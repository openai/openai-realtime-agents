import {
  processUserInputAsync,
  exportContext,
  notifyBenefitConfirmed,
  setCameraVerified
} from '../utils';
import {
  consultarBeneficioAsync,
  simularEmprestimo,
  calcularApresentacaoMarlene
} from '../../loanSimulator/index';

function getSaoPauloHour(): number {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo'
  });
  return parseInt(formatter.format(new Date()), 10);
}

const toolLogic = {
  handleUserMessage: async (args: { message: string }) => {
    const processResult = await processUserInputAsync(args.message);
    const ctx = exportContext();
    return {
      processedInfo: {
        detectedEntities: processResult.entities,
        recommendedState: processResult.recommendedState,
        currentState: ctx.currentState
      }
    };
  },
  open_camera: () => {
    console.log(`[toolLogic] Abrindo câmera para verificação`);
    setCameraVerified(false);
    return { cameraOpened: true };
  },
  close_camera: () => {
    console.log(`[toolLogic] Fechando câmera`);
    return { cameraClosed: true };
  },
  animate_loan_value: (args: { amount: string }) => {
    console.log(`[toolLogic] Animando valor: ${args.amount}`);
    return { highlightedAmount: args.amount };
  },
  time_greeting: () => {
    const hour = getSaoPauloHour();
    let greeting = 'Boa noite';
    if (hour >= 6 && hour < 12) {
      greeting = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      greeting = 'Boa tarde';
    }
    console.log(`[toolLogic] Saudação gerada: ${greeting}`);
    return { greeting };
  },
  say_time_greeting: () => {
    const hour = getSaoPauloHour();
    let greeting = 'Boa noite';
    if (hour >= 6 && hour < 12) {
      greeting = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      greeting = 'Boa tarde';
    }
    console.log(`[toolLogic] Saudação falada: ${greeting}`);
    return { greeting };
  },
  verify_understanding: (args: {
    loanAmount: string;
    installmentValue: string;
    term: number;
    benefitImpactPercentage: number;
  }) => {
    console.log(
      `[toolLogic] Verificando entendimento do cliente sobre os termos do empréstimo`
    );
    const riskAssessment: any = { overallRisk: 'baixo', specificRisks: [] };
    if (args.benefitImpactPercentage > 25) {
      riskAssessment.specificRisks.push({
        type: 'impacto_elevado',
        description:
          'O comprometimento do benefício está acima de 25%, o que pode ser significativo para o sustento mensal',
        recommendation:
          'Oferecer simulação com valor menor ou prazo mais longo para reduzir o impacto mensal'
      });
    }
    if (args.term > 60) {
      riskAssessment.specificRisks.push({
        type: 'prazo_longo',
        description:
          'Prazo superior a 60 meses pode ser difícil de compreender em termos de impacto total',
        recommendation:
          'Enfatizar quanto tempo é 84 meses em anos (7 anos) para facilitar compreensão'
      });
    }
    if (riskAssessment.specificRisks.length > 0) {
      riskAssessment.overallRisk = 'médio';
    }
    if (riskAssessment.specificRisks.length > 2) {
      riskAssessment.overallRisk = 'alto';
    }
    return {
      isUnderstandingConfirmed: riskAssessment.overallRisk === 'baixo',
      riskAssessment,
      suggestedExplanations: [
        `Com esse empréstimo de ${args.loanAmount}, você pagaria ${args.installmentValue} por mês, durante ${args.term} meses. Isso seria como guardar ${args.installmentValue} todo mês para pagar o empréstimo.`,
        `Dos seus ${args.benefitImpactPercentage}% do benefício que vai para o pagamento, ainda sobram ${100 - args.benefitImpactPercentage}% para suas outras despesas.`
      ]
    };
  },
  simplify_financial_explanation: ({ concept, context }: { concept: string; context?: string }) => {
    console.log(`[toolLogic] Simplificando explicação: ${concept}, contexto: ${context || 'geral'}`);
    return {
      concept,
      simpleExplanation: `O ${concept} é como o dinheiro que você paga todo mês, como se fosse uma conta de água ou luz. É um valor fixo que sai do seu benefício automaticamente.`,
      analogyExplanation: `Vamos pensar no ${concept} como fatias de um bolo. Se seu benefício é o bolo inteiro, a parcela é só uma fatia pequena que você vai tirar todo mês para pagar o empréstimo. O importante é que sobre bastante bolo para você.`,
      visualRepresentation:
        concept === 'parcela'
          ? '🍰✂️'
          : concept === 'prazo'
          ? '📆➡️📆'
          : concept === 'juros'
          ? '💵➕'
          : concept === 'margem_consignável'
          ? '💰🔒'
          : '💵',
      adjustedForContext: context ? `No seu caso, como ${context}, isso significa que...` : null
    };
  },
  handle_camera_error: (args: { errorType: string; alternativeMethod?: string }) => {
    console.log(`[toolLogic] Tratando erro de câmera: ${args.errorType}`);
    const errorMessages: any = {
      permission_denied: 'Parece que não consegui permissão para usar a câmera.',
      device_unavailable: 'Parece que a câmera não está disponível no momento.',
      timeout: 'A verificação está demorando mais que o esperado.',
      other: 'Estamos tendo um problema com a verificação.'
    };
    const alternativeOptions: any = {
      try_again: {
        steps: ['Vamos tentar mais uma vez. Às vezes é só tocar de novo no botão da câmera.'],
        userGuidance: 'Toque novamente no botão da câmera quando aparecer.'
      },
      phone_verification: {
        steps: ['Vamos verificar por mensagem de texto', 'Enviarei um código para seu celular', 'Você me informa o código para confirmar sua identidade'],
        userGuidance: 'Em instantes, você vai receber uma mensagem com um código de 5 números no seu celular. Quando receber, me diga quais são os números.'
      },
      in_person_verification: {
        steps: ['Faremos a verificação aqui mesmo com seus documentos', 'Preciso ver seu documento com foto'],
        userGuidance: 'Poderia me mostrar seu documento com foto? É só um minutinho para confirmar.'
      }
    };
    const alternativeMethod = args.alternativeMethod || 'phone_verification';
    return {
      errorMessage: errorMessages[args.errorType] || errorMessages.other,
      reassuranceMessage: 'Não se preocupe, temos um jeito mais fácil de fazer essa verificação.',
      alternativeMethod: alternativeOptions[alternativeMethod],
      verificationCode: alternativeMethod === 'phone_verification' ? '12345' : null
    };
  },
  include_companion: (args: { hasCompanion: boolean; relationshipType?: string }) => {
    console.log(`[toolLogic] Ajustando para acompanhante: ${args.hasCompanion}, tipo: ${args.relationshipType || 'não especificado'}`);
    if (!args.hasCompanion) {
      return {
        adjustedApproach: 'comunicação_direta',
        suggestions: [
          'Use linguagem ainda mais simples e visual',
          'Ofereça ajuda frequentemente para interações digitais',
          'Verifique compreensão com mais frequência'
        ]
      };
    }
    const strategies: any = {
      'filho(a)': {
        role: 'mediador_principal',
        approach: 'Inclua nas explicações, mas mantenha as decisões com o beneficiário',
        suggestedPrompts: [
          'Seu/Sua filho(a) está acompanhando, então vou explicar para vocês dois',
          'Pode pedir ajuda dele(a) para a parte da câmera'
        ]
      },
      'cônjuge': {
        role: 'parceiro_decisão',
        approach: 'Trate como decisão conjunta, direcione-se a ambos igualmente',
        suggestedPrompts: ['Vocês estão de acordo com esses valores?', 'Preferem uma parcela menor?']
      },
      'neto(a)': {
        role: 'suporte_tecnológico',
        approach: 'Utilize para auxílio tecnológico, mas direcione decisões ao idoso',
        suggestedPrompts: ['Seu/Sua neto(a) pode ajudar com a câmera, mas quero confirmar se está de acordo']
      },
      default: {
        role: 'auxiliar',
        approach: 'Reconheça presença, mas foque comunicação no beneficiário',
        suggestedPrompts: ['Que bom que veio com alguém, isso ajuda', 'Vou explicar para você, e se tiver dúvida, podem perguntar também']
      }
    };
    return {
      adjustedApproach: 'acompanhante_incluido',
      companionStrategy: strategies[args.relationshipType] || strategies.default,
      verificationRecommendation: 'Ainda assim, verifique consentimento direto do beneficiário'
    };
  },
  create_accessible_documentation: (args: { customerName: string; loanDetails: any; deliveryMethod: string }) => {
    console.log(`[toolLogic] Criando documentação acessível para ${args.customerName}`);
    const deliveryOptions: any = {
      whatsapp_audio: {
        format: 'áudio',
        benefits: ['Não depende de leitura', 'Pode ser ouvido várias vezes', 'Familiar para o cliente'],
        exampleScript: `Olá, ${args.customerName}! Aqui é a Marlene da Credmais. Estou enviando a confirmação do seu empréstimo de ${args.loanDetails.loanAmount}. Vai ser descontado ${args.loanDetails.installmentValue} por mês do seu benefício, durante ${args.loanDetails.term} meses. O dinheiro estará na sua conta em até 2 dias úteis. Qualquer dúvida, pode me ligar no número da Credmais. Obrigada pela confiança!`
      },
      sms: {
        format: 'texto simples',
        benefits: ['Fica registrado no celular', 'Pode ser mostrado para familiares'],
        exampleText: `Credmais: ${args.customerName}, emprestimo ${args.loanDetails.loanAmount} aprovado. Parcela ${args.loanDetails.installmentValue} x ${args.loanDetails.term}. Dinheiro em 2 dias. Duvidas? Ligue (XX) XXXX-XXXX`
      },
      print_visual: {
        format: 'documento visual',
        benefits: ['Contém ícones para fácil compreensão', 'Cores destacam informações importantes'],
        visualElements: ['🏦 - Credmais Consignado', '💵 - Valor do empréstimo', '📅 - Duração do contrato', '💰 - Valor da parcela', '📱 - Contato para dúvidas']
      }
    };
    return {
      documentationCreated: true,
      deliveryMethod: args.deliveryMethod,
      documentDetails: deliveryOptions[args.deliveryMethod],
      retentionSuggestions: [
        'Peça para o cliente salvar o número da Credmais no celular',
        'Sugira que compartilhe as informações com um familiar de confiança',
        'Lembre que pode vir à loja a qualquer momento para tirar dúvidas'
      ]
    };
  },
  verifyCustomerInfo: async ({ customerName, benefitNumber }: { customerName?: string; benefitNumber: string }) => {
    console.log(`[toolLogic] Consultando benefício: ${benefitNumber || 'não fornecido'}`);
    const info = await consultarBeneficioAsync(benefitNumber, customerName || 'Cliente');
    const fullName = customerName || info.beneficiario.nome;
    const benefitType = info.beneficiario.tipoBeneficio;
    const availableLimit = `R$ ${info.credito.valorMaximoAprovado.toLocaleString('pt-BR')}`;
    const benefitValue = info.beneficio.valor;
    const marginValue = info.beneficio.margemDisponivel;
    const marginPercent = parseFloat(((marginValue / info.beneficio.valor) * 100).toFixed(2));
    return {
      isVerified: true,
      customerInfo: { fullName, benefitType, availableLimit, benefitValue, marginPercent, marginValue }
    };
  },
  consult_benefit: async ({ benefitNumber, customerName }: { benefitNumber: string; customerName?: string }) => {
    const info = await consultarBeneficioAsync(benefitNumber, customerName || 'Cliente');
    const ctx = exportContext();
    if (!ctx.cameraVerified) {
      notifyBenefitConfirmed();
    }
    const fullName = customerName || info.beneficiario.nome;
    const benefitType = info.beneficiario.tipoBeneficio;
    const availableLimit = `R$ ${info.credito.valorMaximoAprovado.toLocaleString('pt-BR')}`;
    const benefitValue = info.beneficio.valor;
    const marginValue = info.beneficio.margemDisponivel;
    const marginPercent = parseFloat(((marginValue / info.beneficio.valor) * 100).toFixed(2));
    return { fullName, benefitType, availableLimit, benefitValue, marginPercent, marginValue };
  },
  simulateLoan: ({ desiredAmount, benefitNumber, customerName, term = 60 }: { desiredAmount: number; benefitNumber?: string; customerName?: string; term?: number }) => {
    console.log(`[toolLogic] Simulando empréstimo pelo módulo loanSimulator: ${desiredAmount}`);
    const amount = desiredAmount || 10000;
    const name = customerName || 'Cliente';
    const num = benefitNumber || '00000000000';
    const result = simularEmprestimo(num, name, amount, term);
    const presentation = calcularApresentacaoMarlene(name, name, num, amount, term);
    return {
      loanAmount: `R$ ${amount.toLocaleString('pt-BR')}`,
      installments: result.prazo,
      monthlyPayment: `R$ ${result.parcela.toLocaleString('pt-BR')}`,
      totalPayable: `R$ ${result.total.toLocaleString('pt-BR')}`,
      impactOnBenefit: `${((result.parcela / result.perfil.beneficio.valor) * 100).toFixed(2)}%`,
      remainingBenefit: `R$ ${(result.perfil.beneficio.valor - result.parcela).toLocaleString('pt-BR')}`,
      simplifiedExplanation: presentation.opcoes[0].texto
    };
  },
  processCameraEvent: (args: { eventType: string }) => {
    console.log(`[toolLogic] Processando evento de câmera: ${args.eventType}`);
    if (args.eventType === 'VERIFICATION_CONFIRMED') {
      setCameraVerified(true);
      return { success: true, message: 'Verificação confirmada', nextStep: 'loan_simulation' };
    }
    if (args.eventType === 'VERIFICATION_FAILED') {
      return { success: false, message: 'Verificação falhou', nextStep: 'retry' };
    }
    if (args.eventType === 'VERIFICATION_CANCELLED') {
      return { success: false, message: 'Verificação cancelada', nextStep: 'early_exit' };
    }
    if (args.eventType === 'CAMERA_CLOSING') {
      return { success: true, message: 'Fechando câmera' };
    }
    return { success: true, message: `Evento de câmera ${args.eventType} processado` };
  }
};

export default toolLogic;
