// Contrato da API (README.md, seção "API"). O front mantém uma cópia
// manual em web/src/api/tipos.ts: mudou aqui, muda lá.

import { UfResumo } from '../municipios/municipios.types';

/** Item da lista de UFs (`GET /api/ufs`); mesma forma da UF nas respostas de município. */
export type UfItem = UfResumo;

/** Agregado de uma UF (`GET /api/ufs/:cdUf`). */
export interface UfAgregado extends UfResumo {
  /** Soma de `mun_agg.populacao` de todos os municípios da UF, incluindo `'.'` (R1). */
  populacao: number;
  /** km², 2 casas (R7); inclui a área de `'.'` (lagoas do RS). */
  areaKm2: number;
  /** hab/km², 2 casas (R7). */
  densidade: number;
  /** Municípios listáveis: exclui `'.'` (R1). */
  totalMunicipios: number;
}

/** Linha do ranking de densidade (`GET /api/ufs/:cdUf/municipios`). */
export interface RankingItem {
  /** `(page - 1) * pageSize + índice + 1`, calculada no servidor (R6). */
  posicao: number;
  cdMun: string;
  nome: string;
  populacao: number;
  /** km², 2 casas (R7). */
  areaKm2: number;
  /** hab/km², 2 casas (R7). */
  densidade: number;
}

/** Página do ranking (`GET /api/ufs/:cdUf/municipios?page=&pageSize=`). */
export interface RankingPagina {
  /** Municípios da UF, sem `'.'`; igual em toda página. */
  total: number;
  page: number;
  pageSize: number;
  itens: RankingItem[];
}
