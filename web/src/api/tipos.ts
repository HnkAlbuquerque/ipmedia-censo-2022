// Espelho manual do contrato da API (README.md, seção "API"), cujas
// fontes são api/src/municipios/municipios.types.ts (município) e
// api/src/ufs/ufs.types.ts (UF): mudou lá, muda aqui. A API é a única fonte
// dos números: o cliente formata, nunca agrega.

export interface Uf {
  cdUf: string;
  sigla: string;
  nome: string;
}

/** Item do autocomplete: `GET /api/municipios?q=`. */
export interface Sugestao {
  cdMun: string;
  nome: string;
  uf: Uf;
}

/** Agregados de um município: `GET /api/municipios/:cdMun`. */
export interface MunicipioDetalhe {
  cdMun: string;
  nome: string;
  uf: Uf;
  populacao: number;
  /** km², já com 2 casas. */
  areaKm2: number;
  /** hab/km², já com 2 casas. */
  densidade: number;
  setores: {
    total: number;
    urbanos: number;
    rurais: number;
    naoInformados: number;
  };
  sexo: {
    homens: number;
    mulheres: number;
    /** População dos setores com dado de sexo. */
    comDado: number;
    /** comDado / populacao, entre 0 e 1. */
    cobertura: number;
  };
}

/** Agregado de um estado: `GET /api/ufs/:cdUf`. Soma inclui a linha sem município (R1). */
export interface UfAgregado extends Uf {
  populacao: number;
  /** km², já com 2 casas. */
  areaKm2: number;
  /** hab/km², já com 2 casas. */
  densidade: number;
  /** Municípios listáveis no ranking. */
  totalMunicipios: number;
}

/** Linha do ranking de densidade: `GET /api/ufs/:cdUf/municipios`. */
export interface RankingItem {
  /** Calculada no servidor: `(page - 1) * pageSize + índice + 1`. */
  posicao: number;
  cdMun: string;
  nome: string;
  populacao: number;
  /** km², já com 2 casas. */
  areaKm2: number;
  /** hab/km², já com 2 casas. */
  densidade: number;
}

/** Página do ranking; `total` é o mesmo em toda página. */
export interface RankingPagina {
  total: number;
  page: number;
  pageSize: number;
  itens: RankingItem[];
}
