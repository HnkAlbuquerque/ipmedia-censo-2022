import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ErroResposta } from '../common/erro.types';
import { TAG_UFS } from '../common/tags';
import { UFS } from '../common/ufs';
import { UfResumo } from '../municipios/municipios.types';
import { UfsService } from './ufs.service';
import { RankingPagina, UfAgregado, UfItem } from './ufs.types';

/** Códigos de UF do IBGE têm 2 dígitos. */
const CD_UF = /^\d{2}$/;
/** Inteiro positivo em decimal, sem sinal, espaço ou casas: o que `page` e `pageSize` aceitam. */
const INTEIRO = /^\d+$/;
const PAGE_PADRAO = 1;
/** Bem acima das 13 páginas de SP; evita OFFSET absurdo e o overflow do SQLite. */
const PAGE_MAXIMO = 100000;
const PAGE_SIZE_PADRAO = 50;
const PAGE_SIZE_MAXIMO = 100;

/** `cdUf` aparece em duas rotas; a descrição do parâmetro fica em um lugar só. */
const PARAM_CD_UF = {
  name: 'cdUf',
  description: 'Código da UF no IBGE, 2 dígitos',
  schema: { type: 'string', pattern: CD_UF.source, example: '35' },
} as const;

/** O mesmo 404 vale para o agregado e para o ranking. */
const UF_NAO_ENCONTRADA = {
  description: 'Código fora do formato ou UF inexistente',
  type: ErroResposta,
  example: {
    statusCode: 404,
    message: 'UF 99 não encontrada',
    error: 'Not Found',
  },
};

/**
 * Converte um parâmetro de query em inteiro entre 1 e `maximo`. Ausente
 * devolve o padrão; qualquer outra coisa (texto, decimal, zero, negativo,
 * parâmetro repetido, acima do máximo ou fora da faixa segura de inteiros)
 * devolve 400. Validação à mão, sem class-validator.
 */
function inteiroPositivo(nome: string, valor: unknown, padrao: number, maximo: number): number {
  if (valor === undefined) {
    return padrao;
  }
  if (typeof valor !== 'string' || !INTEIRO.test(valor)) {
    throw new BadRequestException(`Parâmetro ${nome} deve ser um inteiro maior ou igual a 1`);
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1) {
    throw new BadRequestException(`Parâmetro ${nome} deve ser um inteiro maior ou igual a 1`);
  }
  if (numero > maximo) {
    throw new BadRequestException(`Parâmetro ${nome} deve ser no máximo ${maximo}`);
  }
  return numero;
}

@ApiTags(TAG_UFS)
@Controller('ufs')
export class UfsController {
  constructor(private readonly service: UfsService) {}

  /** `GET /api/ufs` -- as 27 UFs em ordem alfabética de nome. */
  @Get()
  @ApiOperation({
    summary: 'Lista de UFs',
    description: 'As 27 UFs em ordem alfabética de nome, para o select da tela.',
  })
  @ApiOkResponse({
    description: 'As 27 UFs',
    type: [UfResumo],
  })
  listar(): UfItem[] {
    return this.service.listar();
  }

  /** `GET /api/ufs/:cdUf` -- agregado do estado. Código fora do formato ou inexistente: 404. */
  @Get(':cdUf')
  @ApiOperation({
    summary: 'Agregados de uma UF',
    description:
      'População, área, densidade e quantidade de municípios do estado inteiro. As somas incluem território sem município (lagoas do RS).',
  })
  @ApiParam(PARAM_CD_UF)
  @ApiOkResponse({ description: 'Agregados da UF', type: UfAgregado })
  @ApiNotFoundResponse(UF_NAO_ENCONTRADA)
  obter(@Param('cdUf') cdUf: string): UfAgregado {
    const uf = this.validarCdUf(cdUf) ? this.service.obter(cdUf) : undefined;
    if (!uf) {
      throw new NotFoundException(`UF ${cdUf} não encontrada`);
    }
    return uf;
  }

  /**
   * `GET /api/ufs/:cdUf/municipios?page=&pageSize=` -- ranking de densidade
   * paginado (R6). `page` default 1, máximo 100000; `pageSize` default 50, máximo 100.
   */
  @Get(':cdUf/municipios')
  @ApiOperation({
    summary: 'Ranking de densidade dos municípios da UF',
    description:
      'Municípios do mais denso ao menos denso, com desempate pelo código, sempre paginado no servidor. Página além do fim devolve 200 com itens vazio.',
  })
  @ApiParam(PARAM_CD_UF)
  // Decorators aplicam de baixo para cima: `pageSize` acima para `page` sair primeiro.
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Itens por página',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGE_SIZE_MAXIMO,
      default: PAGE_SIZE_PADRAO,
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página, a partir de 1',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGE_MAXIMO,
      default: PAGE_PADRAO,
    },
  })
  @ApiOkResponse({ description: 'Página do ranking', type: RankingPagina })
  @ApiBadRequestResponse({
    description:
      'page ou pageSize que não é inteiro positivo, está acima do máximo ou veio repetido',
    type: ErroResposta,
    example: {
      statusCode: 400,
      message: `Parâmetro pageSize deve ser no máximo ${PAGE_SIZE_MAXIMO}`,
      error: 'Bad Request',
    },
  })
  @ApiNotFoundResponse(UF_NAO_ENCONTRADA)
  ranking(
    @Param('cdUf') cdUf: string,
    @Query('page') page?: unknown,
    @Query('pageSize') pageSize?: unknown,
  ): RankingPagina {
    const pagina = inteiroPositivo('page', page, PAGE_PADRAO, PAGE_MAXIMO);
    const tamanho = inteiroPositivo('pageSize', pageSize, PAGE_SIZE_PADRAO, PAGE_SIZE_MAXIMO);

    const resultado = this.validarCdUf(cdUf)
      ? this.service.ranking(cdUf, pagina, tamanho)
      : undefined;
    if (!resultado) {
      throw new NotFoundException(`UF ${cdUf} não encontrada`);
    }
    return resultado;
  }

  /** 2 dígitos e presente em `UFS`; o service ainda confere a tabela `uf`. */
  private validarCdUf(cdUf: string): boolean {
    return CD_UF.test(cdUf) && cdUf in UFS;
  }
}
