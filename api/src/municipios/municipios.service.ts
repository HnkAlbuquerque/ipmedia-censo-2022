import { Injectable } from '@nestjs/common';
import { normalizar } from '../common/normalizar';
import { UFS } from '../common/ufs';
import { DbService } from '../db/db.service';
import { MunicipioDetalhe, Sugestao, UfResumo } from './municipios.types';

/** Linha devolvida pela consulta de busca. */
interface LinhaBusca {
  cd_mun: string;
  nm_mun: string;
  cd_uf: string;
}

/** Linha devolvida pela consulta de detalhe: `municipio` + `mun_agg`. */
interface LinhaDetalhe extends LinhaBusca {
  setores_total: number;
  setores_urbanos: number;
  setores_rurais: number;
  setores_nao_informados: number;
  populacao: number;
  area_km2: number;
  homens: number;
  mulheres: number;
  moradores: number;
}

/**
 * Arredonda a `casas` decimais; usado para área, densidade e cobertura (R7).
 * Desloca a vírgula pela notação exponencial em vez de multiplicar: `1.005 * 100`
 * dá `100.49999...` em binário e arredondaria para baixo.
 */
export function arredondar(valor: number, casas: number): number {
  return Number(`${Math.round(Number(`${valor}e${casas}`))}e-${casas}`);
}

/**
 * `%` e `_` são curingas do LIKE; escapados aqui e declarados com `ESCAPE '\'`
 * na consulta, o termo do usuário casa só de forma literal.
 */
function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => '\\' + c);
}

/** Monta `{ cdUf, sigla, nome }` a partir do mapa estático de UFs. */
function ufDe(cdUf: string): UfResumo {
  const uf = UFS[cdUf];
  if (!uf) {
    // O teste de integração garante que a tabela `uf` e o mapa coincidem;
    // chegar aqui é um bug de dados, não um erro do cliente.
    throw new Error(`UF desconhecida: ${cdUf}`);
  }
  return { cdUf, sigla: uf.sigla, nome: uf.nome };
}

@Injectable()
export class MunicipiosService {
  constructor(private readonly dbService: DbService) {}

  /**
   * Autocomplete por prefixo de palavra em `nm_mun_busca` (R4). Palavra começa
   * no início do nome ou depois de espaço, hífen ou apóstrofo ("Guajará-Mirim",
   * "Espigão D'Oeste"). Ordem: nome exato, população, nome e, por último,
   * `cd_mun`, para homônimos de mesma população saírem sempre na mesma ordem;
   * até 10 itens. `cd_mun = '.'` (setores das lagoas do RS) fica fora (R1).
   * Termo com menos de 2 caracteres devolve `[]`: o controller já barra com
   * 400, e sem essa guarda um termo vazio viraria `LIKE '%'` e casaria tudo.
   */
  buscar(q: string): Sugestao[] {
    const termo = normalizar(q);
    if (termo.length < 2) {
      return [];
    }
    const escapado = escaparLike(termo);

    const linhas = this.dbService.db
      .prepare(
        `SELECT m.cd_mun, m.nm_mun, m.cd_uf
           FROM municipio m
           JOIN mun_agg a ON a.cd_mun = m.cd_mun
          WHERE m.cd_mun <> '.'
            AND (m.nm_mun_busca LIKE @prefixo ESCAPE '\\'
                 OR m.nm_mun_busca LIKE @palavra ESCAPE '\\'
                 OR m.nm_mun_busca LIKE @hifen ESCAPE '\\'
                 OR m.nm_mun_busca LIKE @apostrofo ESCAPE '\\')
          ORDER BY CASE WHEN m.nm_mun_busca = @termo THEN 0 ELSE 1 END,
                   a.populacao DESC,
                   m.nm_mun,
                   m.cd_mun
          LIMIT 10`,
      )
      .all({
        termo,
        prefixo: `${escapado}%`,
        palavra: `% ${escapado}%`,
        hifen: `%-${escapado}%`,
        apostrofo: `%'${escapado}%`,
      }) as LinhaBusca[];

    return linhas.map((l) => ({
      cdMun: l.cd_mun,
      nome: l.nm_mun,
      uf: ufDe(l.cd_uf),
    }));
  }

  /**
   * Agregados de um município a partir de `mun_agg`. `undefined` quando o
   * código não existe ou é `'.'` (R1): o controller converte em 404.
   */
  obter(cdMun: string): MunicipioDetalhe | undefined {
    const linha = this.dbService.db
      .prepare(
        `SELECT m.cd_mun, m.nm_mun, m.cd_uf,
                a.setores_total, a.setores_urbanos, a.setores_rurais,
                a.setores_nao_informados, a.populacao, a.area_km2,
                a.homens, a.mulheres, a.moradores
           FROM municipio m
           JOIN mun_agg a ON a.cd_mun = m.cd_mun
          WHERE m.cd_mun = ? AND m.cd_mun <> '.'`,
      )
      .get(cdMun) as LinhaDetalhe | undefined;

    if (!linha) {
      return undefined;
    }

    // Densidade e cobertura calculadas sobre os valores crus e só então
    // arredondadas (R7); divisões por zero viram 0 em vez de Infinity/NaN.
    const densidade =
      linha.area_km2 > 0 ? linha.populacao / linha.area_km2 : 0;
    const cobertura =
      linha.populacao > 0 ? linha.moradores / linha.populacao : 0;

    return {
      cdMun: linha.cd_mun,
      nome: linha.nm_mun,
      uf: ufDe(linha.cd_uf),
      populacao: linha.populacao,
      areaKm2: arredondar(linha.area_km2, 2),
      densidade: arredondar(densidade, 2),
      setores: {
        total: linha.setores_total,
        urbanos: linha.setores_urbanos,
        rurais: linha.setores_rurais,
        naoInformados: linha.setores_nao_informados,
      },
      sexo: {
        homens: linha.homens,
        mulheres: linha.mulheres,
        comDado: linha.moradores,
        cobertura: arredondar(cobertura, 4),
      },
    };
  }
}
