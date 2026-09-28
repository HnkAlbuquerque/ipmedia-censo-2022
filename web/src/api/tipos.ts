// Espelho manual do contrato da API (stack.md, "Contrato da API"), cuja fonte
// é api/src/municipios/municipios.types.ts: mudou lá, muda aqui. A API é a
// única fonte dos números: o cliente formata, nunca agrega.

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
