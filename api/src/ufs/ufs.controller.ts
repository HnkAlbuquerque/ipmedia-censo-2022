import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { UFS } from '../common/ufs';
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

@Controller('ufs')
export class UfsController {
  constructor(private readonly service: UfsService) {}

  /** `GET /api/ufs` -- as 27 UFs em ordem alfabética de nome. */
  @Get()
  listar(): UfItem[] {
    return this.service.listar();
  }

  /** `GET /api/ufs/:cdUf` -- agregado do estado. Código fora do formato ou inexistente: 404. */
  @Get(':cdUf')
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
