// Contrato da API (README.md, seção "API"). As classes tipam o service e
// geram o esquema OpenAPI (`/api/docs`). O front mantém uma cópia manual em
// web/src/api/tipos.ts: mudou aqui, muda lá.
//
// Exemplos com valores reais do Censo 2022: UF `35` (São Paulo) e o primeiro
// do ranking de densidade do estado, Taboão da Serra.

import { ApiProperty } from '@nestjs/swagger';
import { UfResumo } from '../municipios/municipios.types';

/** Item da lista de UFs (`GET /api/ufs`); mesma forma da UF nas respostas de município. */
export type UfItem = UfResumo;

/** Agregado de uma UF (`GET /api/ufs/:cdUf`). */
export class UfAgregado extends UfResumo {
  /** Soma de `mun_agg.populacao` de todos os municípios da UF, incluindo `'.'` (R1). */
  @ApiProperty({
    description: 'População da UF, inteira, nunca arredondada',
    type: 'integer',
    example: 44411238,
  })
  populacao!: number;

  /** km², 2 casas (R7); inclui a área de `'.'` (lagoas do RS). */
  @ApiProperty({
    description:
      'Área em km², 2 casas; inclui território sem município (lagoas do RS)',
    example: 248219.49,
  })
  areaKm2!: number;

  /** hab/km², 2 casas (R7). */
  @ApiProperty({
    description:
      'Densidade em hab/km², 2 casas, calculada sobre a área antes do arredondamento',
    example: 178.92,
  })
  densidade!: number;

  /** Municípios listáveis: exclui `'.'` (R1). */
  @ApiProperty({
    description: 'Municípios da UF que aparecem no ranking',
    type: 'integer',
    example: 645,
  })
  totalMunicipios!: number;
}

/** Linha do ranking de densidade (`GET /api/ufs/:cdUf/municipios`). */
export class RankingItem {
  /** `(page - 1) * pageSize + índice + 1`, calculada no servidor (R6). */
  @ApiProperty({
    description:
      'Posição no ranking da UF, calculada no servidor: (page - 1) * pageSize + índice + 1',
    type: 'integer',
    minimum: 1,
    example: 1,
  })
  posicao!: number;

  @ApiProperty({
    description: 'Código do município no IBGE, 7 dígitos',
    example: '3552809',
  })
  cdMun!: string;

  @ApiProperty({
    description: 'Nome do município',
    example: 'Taboão da Serra',
  })
  nome!: string;

  @ApiProperty({
    description: 'População, inteira, nunca arredondada',
    type: 'integer',
    example: 273542,
  })
  populacao!: number;

  /** km², 2 casas (R7). */
  @ApiProperty({ description: 'Área em km², 2 casas', example: 20.39 })
  areaKm2!: number;

  /** hab/km², 2 casas (R7). */
  @ApiProperty({
    description: 'Densidade em hab/km², 2 casas',
    example: 13416.96,
  })
  densidade!: number;
}

/** Página do ranking (`GET /api/ufs/:cdUf/municipios?page=&pageSize=`). */
export class RankingPagina {
  /** Municípios da UF, sem `'.'`; igual em toda página. */
  @ApiProperty({
    description: 'Total de municípios da UF; igual em toda página',
    type: 'integer',
    example: 645,
  })
  total!: number;

  @ApiProperty({
    description: 'Página devolvida',
    type: 'integer',
    minimum: 1,
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Tamanho de página aplicado',
    type: 'integer',
    minimum: 1,
    example: 50,
  })
  pageSize!: number;

  @ApiProperty({
    description:
      'Municípios da página, do mais denso ao menos denso; vazio além da última página',
    type: () => [RankingItem],
  })
  itens!: RankingItem[];
}
