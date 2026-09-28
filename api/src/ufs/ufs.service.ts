import { Injectable } from '@nestjs/common';
import { UFS } from '../common/ufs';
import { DbService } from '../db/db.service';
import { arredondar } from '../municipios/municipios.service';
import { RankingItem, RankingPagina, UfAgregado, UfItem } from './ufs.types';

/** Linha da tabela `uf`. */
interface LinhaUf {
  cd_uf: string;
  nm_uf: string;
}

/** Soma de `mun_agg` por UF. */
interface LinhaAgregado {
  populacao: number;
  area_km2: number;
  total_municipios: number;
}

/** Linha do ranking: `municipio` + `mun_agg`, densidade calculada sobre a área crua. */
interface LinhaRanking {
  cd_mun: string;
  nm_mun: string;
  populacao: number;
  area_km2: number;
  dens: number;
}

/**
 * Ordem alfabética em português: o `ORDER BY nm_uf` do SQLite compara bytes e
 * poria "Paraná" antes de "Pará" e "Sergipe" antes de "São Paulo".
 */
const ordemPtBr = new Intl.Collator('pt-BR');

@Injectable()
export class UfsService {
  constructor(private readonly dbService: DbService) {}

  /**
   * As 27 UFs, nome da tabela `uf` e sigla do mapa estático `UFS`, em ordem
   * alfabética de nome (Acre primeiro, Tocantins por último).
   */
  listar(): UfItem[] {
    const linhas = this.dbService.db
      .prepare('SELECT cd_uf, nm_uf FROM uf')
      .all() as LinhaUf[];
    return linhas
      .map((l) => this.montarUf(l))
      .sort((a, b) => ordemPtBr.compare(a.nome, b.nome));
  }

  /**
   * Agregado da UF somando `mun_agg` de todos os seus municípios, inclusive
   * `cd_mun = '.'` (R1): as lagoas do RS contam na área do estado. Só
   * `totalMunicipios` exclui `'.'`. `undefined` para UF inexistente (404).
   */
  obter(cdUf: string): UfAgregado | undefined {
    const uf = this.buscarUf(cdUf);
    if (!uf) {
      return undefined;
    }

    const soma = this.dbService.db
      .prepare(
        `SELECT coalesce(sum(a.populacao), 0) AS populacao,
                coalesce(sum(a.area_km2), 0) AS area_km2,
                count(CASE WHEN m.cd_mun <> '.' THEN 1 END) AS total_municipios
           FROM municipio m
           JOIN mun_agg a ON a.cd_mun = m.cd_mun
          WHERE m.cd_uf = ?`,
      )
      .get(cdUf) as LinhaAgregado;

    // Densidade sobre os valores crus e só então arredondada (R7).
    const densidade = soma.area_km2 > 0 ? soma.populacao / soma.area_km2 : 0;

    return {
      ...uf,
      populacao: soma.populacao,
      areaKm2: arredondar(soma.area_km2, 2),
      densidade: arredondar(densidade, 2),
      totalMunicipios: soma.total_municipios,
    };
  }

  /**
   * Ranking de densidade da UF, paginado (R6): `densidade DESC, cd_mun ASC`
   * calculado sobre a área crua, `'.'` fora (R1), `posicao` calculada aqui.
   * Página além do fim devolve `itens: []` com o `total` certo. `undefined`
   * para UF inexistente (404). `page` e `pageSize` chegam validados do controller.
   */
  ranking(cdUf: string, page: number, pageSize: number): RankingPagina | undefined {
    if (!this.buscarUf(cdUf)) {
      return undefined;
    }
    const db = this.dbService.db;

    const { total } = db
      .prepare(
        `SELECT count(*) AS total
           FROM municipio m
           JOIN mun_agg a ON a.cd_mun = m.cd_mun
          WHERE m.cd_uf = ? AND m.cd_mun <> '.'`,
      )
      .get(cdUf) as { total: number };

    // Área zero não ocorre no arquivo, mas a divisão fica protegida: um
    // município sem área iria para o fim do ranking em vez de virar Infinity.
    const linhas = db
      .prepare(
        `SELECT m.cd_mun, m.nm_mun, a.populacao, a.area_km2,
                CASE WHEN a.area_km2 > 0 THEN a.populacao * 1.0 / a.area_km2 ELSE 0 END AS dens
           FROM municipio m
           JOIN mun_agg a ON a.cd_mun = m.cd_mun
          WHERE m.cd_uf = ? AND m.cd_mun <> '.'
          ORDER BY dens DESC, m.cd_mun ASC
          LIMIT ? OFFSET ?`,
      )
      .all(cdUf, pageSize, (page - 1) * pageSize) as LinhaRanking[];

    const itens: RankingItem[] = linhas.map((l, indice) => ({
      posicao: (page - 1) * pageSize + indice + 1,
      cdMun: l.cd_mun,
      nome: l.nm_mun,
      populacao: l.populacao,
      areaKm2: arredondar(l.area_km2, 2),
      densidade: arredondar(l.dens, 2),
    }));

    return { total, page, pageSize, itens };
  }

  /** UF pela tabela `uf`; `undefined` quando o código não existe lá. */
  private buscarUf(cdUf: string): UfItem | undefined {
    const linha = this.dbService.db
      .prepare('SELECT cd_uf, nm_uf FROM uf WHERE cd_uf = ?')
      .get(cdUf) as LinhaUf | undefined;
    return linha ? this.montarUf(linha) : undefined;
  }

  /** Cruza a linha da tabela `uf` com a sigla de `UFS`. */
  private montarUf(linha: LinhaUf): UfItem {
    const uf = UFS[linha.cd_uf];
    if (!uf) {
      // O teste de integração garante que a tabela `uf` e o mapa coincidem;
      // chegar aqui é um bug de dados, não um erro do cliente.
      throw new Error(`UF desconhecida: ${linha.cd_uf}`);
    }
    return { cdUf: linha.cd_uf, sigla: uf.sigla, nome: linha.nm_uf };
  }
}
