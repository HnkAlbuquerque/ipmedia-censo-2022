// Contrato da API (stack.md, "Contrato da API"). O front mantém uma cópia
// manual em web/src/api/tipos.ts: mudou aqui, muda lá.

/** UF como aparece em toda resposta que envolve município (sigla vem de `UFS`). */
export interface UfResumo {
  cdUf: string;
  sigla: string;
  nome: string;
}

/** Item do autocomplete (`GET /api/municipios?q=`). */
export interface Sugestao {
  cdMun: string;
  nome: string;
  uf: UfResumo;
}

/** Agregado de um município (`GET /api/municipios/:cdMun`). */
export interface MunicipioDetalhe {
  cdMun: string;
  nome: string;
  uf: UfResumo;
  /** Soma de `setor.populacao`, inteira, nunca arredondada (R2, R7). */
  populacao: number;
  /** km², 2 casas (R7). */
  areaKm2: number;
  /** hab/km², 2 casas (R7). */
  densidade: number;
  /** urbanos + rurais + naoInformados = total, sempre (R3). */
  setores: {
    total: number;
    urbanos: number;
    rurais: number;
    naoInformados: number;
  };
  /** Sexo vem de `demografia`; `comDado` é a população dos setores com dado (R2). */
  sexo: {
    homens: number;
    mulheres: number;
    comDado: number;
    /** comDado / populacao, entre 0 e 1, 4 casas. */
    cobertura: number;
  };
}
