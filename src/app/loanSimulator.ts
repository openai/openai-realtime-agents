export interface BeneficioInfo {
  benefitNumber: string;
  fullName: string;
  benefitType: string;
  benefitValue: number;
  marginPercent: number;
  marginValue: number;
  availableLimit: number;
}

export interface EmprestimoResultado {
  parcela: number;
  total: number;
  term: number;
  impactoPercentual: number;
}

/**
 * Consulta informações do benefício de forma simulada
 */
export function consultarBeneficio(benefitNumber: string): BeneficioInfo {
  const benefitValue = 1800;
  const marginPercent = 30;
  const marginValue = (benefitValue * marginPercent) / 100;
  const availableLimit = 15000;

  return {
    benefitNumber,
    fullName: "Cliente",
    benefitType: "Aposentadoria por Tempo de Contribuição",
    benefitValue,
    marginPercent,
    marginValue,
    availableLimit,
  };
}

/**
 * Simula um empréstimo consignado
 */
export function simularEmprestimo(
  amount: number,
  benefitValue: number,
  term = 60,
  rate = 0.018
): EmprestimoResultado {
  const parcela = Math.round(
    (amount * (rate * Math.pow(1 + rate, term))) /
      (Math.pow(1 + rate, term) - 1)
  );

  return {
    parcela,
    total: parcela * term,
    term,
    impactoPercentual: Math.round((parcela / benefitValue) * 100),
  };
}

/**
 * Texto simplificado para Marlene apresentar a simulação
 */
export function calcularApresentacaoMarlene(
  simulacao: EmprestimoResultado,
  _beneficio: BeneficioInfo
): string {
  return `Com base no benefício, a parcela seria de R$ ${simulacao.parcela.toLocaleString(
    'pt-BR'
  )}, durante ${simulacao.term} meses, comprometendo cerca de ${simulacao.impactoPercentual}% do benefício.`;
}
