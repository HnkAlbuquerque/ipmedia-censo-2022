// Contrato da API (README.md, seção "API"). As classes tipam o service e
// geram o esquema OpenAPI (`/api/docs`). O front mantém uma cópia manual em
// web/src/api/tipos.ts: mudou aqui, muda lá.
//
// `@ApiProperty` é explícito em cada campo: o plugin do Nest CLI não roda no
// ts-jest e o esquema sairia vazio nos e2e. Os exemplos são valores reais do
// Censo 2022 (São Paulo capital, `3550308`).

import { ApiProperty } from '@nestjs/swagger';

/** UF como aparece em toda resposta que envolve município (sigla vem de `UFS`). */
export class UfResumo {
  @ApiProperty({
    description: 'Código da UF no IBGE, 2 dígitos',
    example: '35',
  })
  cdUf!: string;

  @ApiProperty({ description: 'Sigla da UF', example: 'SP' })
  sigla!: string;

  @ApiProperty({ description: 'Nome da UF', example: 'São Paulo' })
  nome!: string;
}

/** Item do autocomplete (`GET /api/municipios?q=`). */
export class Sugestao {
  @ApiProperty({
    description: 'Código do município no IBGE, 7 dígitos',
    example: '3550308',
  })
  cdMun!: string;

  @ApiProperty({ description: 'Nome do município', example: 'São Paulo' })
  nome!: string;

  @ApiProperty({
    description: 'UF do município; distingue homônimos',
    type: () => UfResumo,
  })
  uf!: UfResumo;
}

/** Setores censitários do município por situação (R3). */
export class SetoresResumo {
  @ApiProperty({
    description: 'Total de setores censitários',
    type: 'integer',
    example: 27301,
  })
  total!: number;

  @ApiProperty({
    description: 'Setores em situação urbana',
    type: 'integer',
    example: 27037,
  })
  urbanos!: number;

  @ApiProperty({
    description: 'Setores em situação rural',
    type: 'integer',
    example: 254,
  })
  rurais!: number;

  @ApiProperty({
    description: 'Setores sem situação informada no arquivo',
    type: 'integer',
    example: 10,
  })
  naoInformados!: number;
}

/** População por sexo, só dos setores com dado em `demografia` (R2). */
export class SexoResumo {
  @ApiProperty({ description: 'Homens', type: 'integer', example: 5380188 })
  homens!: number;

  @ApiProperty({ description: 'Mulheres', type: 'integer', example: 6060887 })
  mulheres!: number;

  @ApiProperty({
    description: 'População dos setores que têm dado por sexo',
    type: 'integer',
    example: 11441079,
  })
  comDado!: number;

  /** comDado / populacao, entre 0 e 1, 4 casas. */
  @ApiProperty({
    description: 'comDado / populacao, entre 0 e 1, com 4 casas',
    minimum: 0,
    maximum: 1,
    example: 0.999,
  })
  cobertura!: number;
}

/** Agregado de um município (`GET /api/municipios/:cdMun`). */
export class MunicipioDetalhe {
  @ApiProperty({
    description: 'Código do município no IBGE, 7 dígitos',
    example: '3550308',
  })
  cdMun!: string;

  @ApiProperty({ description: 'Nome do município', example: 'São Paulo' })
  nome!: string;

  @ApiProperty({ description: 'UF do município', type: () => UfResumo })
  uf!: UfResumo;

  /** Soma de `setor.populacao`, inteira, nunca arredondada (R2, R7). */
  @ApiProperty({
    description: 'População: soma dos setores, inteira, nunca arredondada',
    type: 'integer',
    example: 11451999,
  })
  populacao!: number;

  /** km², 2 casas (R7). */
  @ApiProperty({ description: 'Área em km², 2 casas', example: 1521.2 })
  areaKm2!: number;

  /** hab/km², 2 casas (R7). */
  @ApiProperty({
    description:
      'Densidade em hab/km², 2 casas, calculada sobre a área antes do arredondamento',
    example: 7528.26,
  })
  densidade!: number;

  /** urbanos + rurais + naoInformados = total, sempre (R3). */
  @ApiProperty({
    description:
      'Setores censitários; urbanos + rurais + naoInformados = total',
    type: () => SetoresResumo,
  })
  setores!: SetoresResumo;

  /** Sexo vem de `demografia`; `comDado` é a população dos setores com dado (R2). */
  @ApiProperty({
    description: 'População por sexo e a cobertura desse dado',
    type: () => SexoResumo,
  })
  sexo!: SexoResumo;
}
