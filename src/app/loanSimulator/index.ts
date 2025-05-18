// src/app/loanSimulator/index.ts

/**
 * Simulador de sistema bancário para empréstimos consignados.
 * Gera dados fictícios e ofertas personalizadas do Itaú.
 */

export interface Beneficiario {
  nome: string;
  idade: number;
  cpf: string;
  tipoBeneficio: string;
  dataConcessao: string;
}

export interface Beneficio {
  numero: string;
  valor: number;
  margemTotal: number;
  margemComprometida: number;
  margemDisponivel: number;
  banco: string;
}

export interface Credito {
  score: number;
  contratacoes: number;
  restricoes: string | null;
  perfilRisco: "baixo" | "medio" | "alto";
  taxaBase: number;
  valorMaximoAprovado: number;
}

export interface OfertaItau {
  nome: string;
  descricao: string;
  reducaoTaxa: number; // em pontos percentuais (ex: 0.15 => 0.15%)
  valorMinimo?: number;
}

export interface ConsultaBeneficio {
  beneficiario: Beneficiario;
  beneficio: Beneficio;
  credito: Credito;
  ofertasItau: OfertaItau[];
  taxasPorPrazo: Record<string, { taxaNominal: number; taxaEfetiva: number; cet: number }>;
}

const sobrenomes = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Pereira",
  "Ferreira",
  "Almeida",
  "Costa",
];

const bancos = [
  "Itaú",
  "Bradesco",
  "Caixa",
  "Banco do Brasil",
  "Santander",
  "Nubank",
];

const benefitCache = new Map<string, ConsultaBeneficio>();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function gerarCPF(): string {
  const n = [] as number[];
  for (let i = 0; i < 9; i++) n.push(randomInt(0, 9));
  const d1 = calcularDigito(n, 10);
  const d2 = calcularDigito([...n, d1], 11);
  return `${n[0]}${n[1]}${n[2]}.${n[3]}${n[4]}${n[5]}.${n[6]}${n[7]}${n[8]}-${d1}${d2}`;
}

function calcularDigito(nums: number[], factor: number): number {
  const total = nums.reduce((sum, num) => sum + num * factor--, 0);
  const rest = (total * 10) % 11;
  return rest === 10 ? 0 : rest;
}

function escolherBanco(): string {
  return Math.random() < 0.4 ? "Itaú" : bancos[randomInt(0, bancos.length - 1)];
}

function escolherTipoBeneficio(): string {
  const tipos = [
    "Aposentadoria por Tempo de Contribuição",
    "Aposentadoria por Idade",
    "Pensão por Morte",
    "BPC/LOAS",
  ];
  return tipos[randomInt(0, tipos.length - 1)];
}

function definirPerfilRisco(score: number): "baixo" | "medio" | "alto" {
  if (score >= 701) return "baixo";
  if (score >= 501) return "medio";
  return "alto";
}

function taxaBasePorPerfil(perfil: "baixo" | "medio" | "alto"): number {
  switch (perfil) {
    case "baixo":
      return randomFloat(1.6, 1.75);
    case "medio":
      return randomFloat(1.75, 1.85);
    default:
      return randomFloat(1.85, 1.98);
  }
}

function ajustarPorTipoBeneficio(
  tipo: string,
  taxa: number,
  valorMaximo: number
): { taxa: number; valorMaximo: number } {
  if (tipo.includes("Tempo")) {
    return { taxa: taxa - 0.05, valorMaximo: valorMaximo * 1.1 };
  }
  if (tipo.includes("BPC")) {
    return { taxa: taxa + 0.05, valorMaximo: valorMaximo * 0.8 };
  }
  return { taxa, valorMaximo };
}

export function consultarBeneficio(
  numeroBeneficio: string,
  nomeCliente: string
): ConsultaBeneficio {
  const cached = benefitCache.get(numeroBeneficio);
  if (cached) return cached;

  const nomeParts = nomeCliente.trim().split(/\s+/);
  const nomeCompleto =
    nomeParts.length > 1
      ? nomeCliente.trim()
      : `${nomeCliente.trim()} ${sobrenomes[randomInt(0, sobrenomes.length - 1)]}`;

  const idade = randomInt(60, 90);
  const cpf = gerarCPF();
  const tipoBeneficio = escolherTipoBeneficio();
  const dataConcessao = new Date(
    randomInt(2000, 2018),
    randomInt(0, 11),
    randomInt(1, 28)
  )
    .toISOString()
    .split("T")[0];

  const valorBeneficio = randomFloat(1412, 7786.02, 2);
  const margemTotal = parseFloat((valorBeneficio * 0.3).toFixed(2));
  const margemComprometida = parseFloat(
    randomFloat(0, valorBeneficio * 0.25).toFixed(2)
  );
  const margemDisponivel = parseFloat(
    (margemTotal - margemComprometida).toFixed(2)
  );
  const banco = escolherBanco();

  const score = randomInt(300, 900);
  const contratacoes = randomInt(0, 3);
  const restricoes = Math.random() < 0.2 ? "Restrições encontradas" : null;
  const perfilRisco = definirPerfilRisco(score);
  let taxaBase = taxaBasePorPerfil(perfilRisco);
  let valorMaximoAprovado = parseFloat(
    (margemDisponivel * randomFloat(15, 25)).toFixed(2)
  );

  const ajuste = ajustarPorTipoBeneficio(
    tipoBeneficio,
    taxaBase,
    valorMaximoAprovado
  );
  taxaBase = ajuste.taxa;
  valorMaximoAprovado = ajuste.valorMaximo;

  const ofertasItau = obterOfertasItau({
    banco,
    contratacoes,
  });

  const taxasPorPrazo = calcularTaxasPorPrazo(taxaBase, ofertasItau);

  const result: ConsultaBeneficio = {
    beneficiario: {
      nome: nomeCompleto,
      idade,
      cpf,
      tipoBeneficio,
      dataConcessao,
    },
    beneficio: {
      numero: numeroBeneficio,
      valor: valorBeneficio,
      margemTotal,
      margemComprometida,
      margemDisponivel,
      banco,
    },
    credito: {
      score,
      contratacoes,
      restricoes,
      perfilRisco,
      taxaBase,
      valorMaximoAprovado,
    },
    ofertasItau,
    taxasPorPrazo,
  };

  benefitCache.set(numeroBeneficio, result);
  return result;
}

/**
 * Versão assíncrona que consulta a rota /api/loan/consult para obter dados
 * gerados por LLM. Quando a variável NEXT_PUBLIC_USE_LLM_BACKEND estiver
 * habilitada no ambiente, utiliza essa rota. Caso contrário, recai no
 * gerador aleatório acima.
 */
export async function consultarBeneficioAsync(
  numeroBeneficio: string,
  nomeCliente: string
): Promise<ConsultaBeneficio> {
  if (process.env.NEXT_PUBLIC_USE_LLM_BACKEND === "true") {
    try {
      const resp = await fetch("/api/loan/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroBeneficio, nomeCliente }),
      });
      if (resp.ok) {
        return (await resp.json()) as ConsultaBeneficio;
      }
      console.error("LLM backend error", await resp.text());
    } catch (err) {
      console.error("Failed to fetch LLM backend", err);
    }
  }
  return consultarBeneficio(numeroBeneficio, nomeCliente);
}

export function obterOfertasItau({
  banco,
  contratacoes,
}: {
  banco: string;
  contratacoes: number;
}): OfertaItau[] {
  const ofertas: OfertaItau[] = [];
  if (banco === "Itaú") {
    ofertas.push({
      nome: "Oferta Itaú Fidelidade",
      descricao: "Desconto para quem recebe no Itaú",
      reducaoTaxa: 0.15,
    });
  }
  if (contratacoes === 0) {
    ofertas.push({
      nome: "Campanha Novo Cliente",
      descricao: "Desconto para primeira contratação",
      reducaoTaxa: 0.1,
    });
  }
  if (Math.random() < 0.5) {
    ofertas.push({
      nome: "Itaú Digital",
      descricao: "Assinatura digital com desconto",
      reducaoTaxa: 0.05,
    });
  }
  return ofertas;
}

function calcularTaxasPorPrazo(
  taxaBase: number,
  ofertas: OfertaItau[]
): Record<string, { taxaNominal: number; taxaEfetiva: number; cet: number }> {
  const reducaoTotal = ofertas.reduce((acc, o) => acc + o.reducaoTaxa, 0);
  const base = taxaBase - reducaoTotal;

  const ajustesPrazo: Record<string, number> = {
    "36": 0.1,
    "48": 0.05,
    "60": 0,
    "72": -0.05,
    "84": -0.08,
  };

  const result: Record<string, { taxaNominal: number; taxaEfetiva: number; cet: number }> = {};
  Object.entries(ajustesPrazo).forEach(([prazo, ajuste]) => {
    const nominal = parseFloat((base + ajuste).toFixed(2));
    result[prazo] = {
      taxaNominal: nominal,
      taxaEfetiva: parseFloat((nominal * 12).toFixed(2)),
      cet: parseFloat((nominal * 13).toFixed(2)),
    };
  });
  return result;
}

export function calcularTaxaPersonalizada(
  perfil: ConsultaBeneficio,
  valor: number,
  prazo: number
): number {
  const taxas = perfil.taxasPorPrazo[prazo.toString()];
  let taxa = taxas.taxaNominal;

  if (valor >= 15000) {
    taxa -= 0.08;
  }
  if (prazo === 72 || prazo === 84) {
    taxa -= 0.07;
  }
  return parseFloat(taxa.toFixed(2));
}

function calcularParcela(valor: number, taxaMensal: number, prazo: number): number {
  const i = taxaMensal / 100;
  const parcela = valor * (i / (1 - Math.pow(1 + i, -prazo)));
  return parseFloat(parcela.toFixed(2));
}

export function simularEmprestimo(
  numeroBeneficio: string,
  nomeCliente: string,
  valor: number,
  prazo: number
) {
  const perfil = consultarBeneficio(numeroBeneficio, nomeCliente);
  const taxa = calcularTaxaPersonalizada(perfil, valor, prazo);
  const parcela = calcularParcela(valor, taxa, prazo);
  const total = parseFloat((parcela * prazo).toFixed(2));
  return {
    valor,
    prazo,
    taxa,
    parcela,
    total,
    perfil,
  };
}

export function compararOpcoes(sim1: any, sim2: any): string {
  const menorParcela = sim1.parcela < sim2.parcela ? sim1 : sim2;
  const texto =
    `Comparando as opções, a parcela de R$ ${menorParcela.parcela.toFixed(2)} ` +
    `em ${menorParcela.prazo} meses é mais vantajosa.`;
  return texto;
}

export function calcularApresentacaoMarlene(
  nomeCliente: string,
  tratamentoPreferido: string,
  numeroBeneficio: string,
  valorSolicitado: number,
  prazoPreferido: number | null = null
) {
  const perfil = consultarBeneficio(numeroBeneficio, nomeCliente);
  const prazos = prazoPreferido ? [prazoPreferido] : [36, 48, 60, 72, 84];

  const opcoes = prazos.map((prazo) => {
    const simulacao = simularEmprestimo(
      numeroBeneficio,
      nomeCliente,
      valorSolicitado,
      prazo
    );
    const oferta = perfil.ofertasItau.map((o) => o.nome).join(", ");
    return {
      prazo,
      parcela: simulacao.parcela,
      total: simulacao.total,
      texto:
        `${tratamentoPreferido} ${nomeCliente}, ` +
        `pegando R$ ${valorSolicitado.toFixed(2)}, ` +
        `pagaria cerca de R$ ${simulacao.parcela.toFixed(2)} por ${prazo} meses.` +
        (oferta
          ? ` Aproveitando ${oferta}, a condição fica melhor.`
          : ""),
    };
  });

  return { perfil, opcoes };
}
