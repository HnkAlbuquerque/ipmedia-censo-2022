// Formatação pt-BR com Intl.NumberFormat. Os valores chegam prontos da API
// (área e densidade já arredondadas no servidor); aqui é só apresentação.

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const decimais = new Map<number, Intl.NumberFormat>();

function formatadorDecimal(casas: number): Intl.NumberFormat {
  let formatador = decimais.get(casas);
  if (!formatador) {
    formatador = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    decimais.set(casas, formatador);
  }
  return formatador;
}

/** `11451999 -> "11.451.999"`. */
export function formatarInteiro(valor: number): string {
  return inteiro.format(valor);
}

/** `1521.2 -> "1.521,20"` (sempre com `casas` decimais). */
export function formatarDecimal(valor: number, casas = 2): string {
  return formatadorDecimal(casas).format(valor);
}

/** Fração entre 0 e 1 em percentual: `0.999 -> "99,9%"`. */
export function formatarPercentual(fracao: number, casas = 1): string {
  return `${formatarDecimal(fracao * 100, casas)}%`;
}
