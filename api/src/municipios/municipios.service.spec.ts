import Database from 'better-sqlite3';
import { normalizar } from '../common/normalizar';
import { DbService } from '../db/db.service';
import { arredondar, MunicipiosService } from './municipios.service';

/**
 * Lógica de busca e de detalhe sem o censo.sqlite: banco em memória com o
 * mínimo de `municipio` + `mun_agg` que exercita nome exato, prefixo de
 * palavra (espaço, hífen, apóstrofo), desempates, a linha `'.'` e os curingas
 * do LIKE. Os valores do arquivo real são conferidos no e2e.
 */
describe('MunicipiosService', () => {
  let db: Database.Database;
  let service: MunicipiosService;

  // [cd_mun, nm_mun, cd_uf, populacao, area_km2, homens, mulheres, moradores]
  const municipios: [string, string, string, number, number, number, number, number][] = [
    ['3550308', 'São Paulo', '35', 11451999, 1521.2015839, 5380188, 6060887, 11441079],
    // Área com centésimo não nulo e cobertura com 4ª casa não nula: separa
    // "2 casas" de "1 casa" e "4 casas" de "3 casas" no arredondamento.
    ['2910800', 'Paulo Afonso', '29', 117000, 1579.789, 57000, 59950, 116950],
    // Homônimos exatos de mesma população: desempate por cd_mun.
    ['2201903', 'Bom Jesus', '22', 11000, 5469.2, 5500, 5500, 11000],
    ['4302303', 'Bom Jesus', '43', 11000, 2600, 5500, 5500, 11000],
    ['2903904', 'Bom Jesus da Lapa', '29', 63000, 4115.5, 31000, 32000, 63000],
    // Não exatos de mesma população: desempate por nome...
    ['3201100', 'Bom Jesus do Norte', '32', 9000, 89, 4500, 4500, 9000],
    ['3107802', 'Bom Jesus do Galho', '31', 9000, 592, 4500, 4500, 9000],
    // ...e, com nome igual, por cd_mun.
    ['1703305', 'Bom Jesus do Tocantins', '17', 5000, 1333, 2500, 2500, 5000],
    ['1501576', 'Bom Jesus do Tocantins', '15', 5000, 2816, 2500, 2500, 5000],
    ['1100106', 'Guajará-Mirim', '11', 39000, 24855, 19500, 19500, 39000],
    ['1100098', "Espigão D'Oeste", '11', 30000, 4518, 15000, 15000, 30000],
    // No arquivo real a linha '.' tem nm_mun_busca = ''; aqui recebe um nome
    // que casaria "sao" de propósito, para provar que só o filtro por cd_mun
    // a mantém fora da lista (R1).
    ['.', '', '43', 0, 13085.9, 0, 0, 0],
  ];

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE municipio (
        cd_mun TEXT PRIMARY KEY, nm_mun TEXT NOT NULL, cd_uf TEXT NOT NULL,
        nm_mun_busca TEXT
      );
      CREATE TABLE mun_agg (
        cd_mun TEXT PRIMARY KEY, setores_total INTEGER, setores_urbanos INTEGER,
        setores_rurais INTEGER, setores_nao_informados INTEGER, populacao INTEGER,
        area_km2 REAL, homens INTEGER, mulheres INTEGER, moradores INTEGER
      );
    `);
    const inserirMun = db.prepare('INSERT INTO municipio VALUES (?, ?, ?, ?)');
    const inserirAgg = db.prepare(
      'INSERT INTO mun_agg VALUES (?, 10, 7, 2, 1, ?, ?, ?, ?, ?)',
    );
    for (const [cd, nome, uf, pop, area, h, m, mor] of municipios) {
      inserirMun.run(cd, nome, uf, cd === '.' ? 'sao lagoas' : normalizar(nome));
      inserirAgg.run(cd, pop, area, h, m, mor);
    }
    service = new MunicipiosService({ db } as DbService);
  });

  afterEach(() => {
    db.close();
  });

  const nomes = (q: string) => service.buscar(q).map((s) => `${s.nome} - ${s.uf.sigla}`);

  describe('buscar', () => {
    it('casa prefixo do nome, ignorando acento e caixa, e traz a UF', () => {
      expect(service.buscar('SÃO')).toEqual([
        {
          cdMun: '3550308',
          nome: 'São Paulo',
          uf: { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
        },
      ]);
    });

    it('casa prefixo de palavra no meio do nome, mais populoso primeiro', () => {
      expect(nomes('paulo')).toEqual(['São Paulo - SP', 'Paulo Afonso - BA']);
    });

    it('casa palavra depois de hífen e de apóstrofo', () => {
      expect(nomes('mirim')).toEqual(['Guajará-Mirim - RO']);
      expect(nomes('oeste')).toEqual(["Espigão D'Oeste - RO"]);
      expect(nomes("d'oeste")).toEqual(["Espigão D'Oeste - RO"]);
    });

    it('não casa sufixo dentro de uma palavra', () => {
      expect(service.buscar('aulo')).toEqual([]);
      expect(service.buscar('irim')).toEqual([]);
    });

    it('ordena: exato, população, nome e por fim cd_mun', () => {
      expect(nomes('bom jesus')).toEqual([
        'Bom Jesus - PI', // exatos empatados em população: cd_mun 2201903...
        'Bom Jesus - RS', // ...antes de 4302303
        'Bom Jesus da Lapa - BA', // composto mais populoso
        'Bom Jesus do Galho - MG', // 9.000, nome antes de "do Norte"
        'Bom Jesus do Norte - ES',
        'Bom Jesus do Tocantins - PA', // 5.000, nome igual: cd_mun 1501576...
        'Bom Jesus do Tocantins - TO', // ...antes de 1703305
      ]);
    });

    it('colapsa espaços e apara o termo antes de comparar', () => {
      expect(service.buscar('  bom   jesus ').map((s) => s.cdMun)).toEqual(
        service.buscar('bom jesus').map((s) => s.cdMun),
      );
    });

    it('nunca devolve a linha cd_mun = "." mesmo com nome que casa (R1)', () => {
      // A fixture dá "sao lagoas" à linha '.': sem o filtro ela apareceria aqui.
      expect(nomes('sao')).toEqual(['São Paulo - SP']);
      expect(service.buscar('sao').every((s) => s.nome !== '')).toBe(true);
    });

    it('devolve [] para termo com menos de 2 caracteres após normalizar', () => {
      expect(service.buscar('')).toEqual([]);
      expect(service.buscar('   ')).toEqual([]);
      expect(service.buscar('s')).toEqual([]);
      expect(service.buscar(' ã ')).toEqual([]);
    });

    it('trata % e _ como literais, não como curingas do LIKE', () => {
      expect(service.buscar('sa_')).toEqual([]);
      expect(service.buscar('s%')).toEqual([]);
      expect(service.buscar('%%')).toEqual([]);
      expect(service.buscar('\\\\')).toEqual([]);
    });

    it('devolve lista vazia quando nada casa', () => {
      expect(service.buscar('xyzxyz')).toEqual([]);
    });
  });

  describe('obter', () => {
    it('monta o detalhe com área e densidade a 2 casas e cobertura a 4 (R2, R3, R7)', () => {
      expect(service.obter('3550308')).toEqual({
        cdMun: '3550308',
        nome: 'São Paulo',
        uf: { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
        populacao: 11451999,
        areaKm2: 1521.2,
        densidade: 7528.26,
        setores: { total: 10, urbanos: 7, rurais: 2, naoInformados: 1 },
        sexo: {
          homens: 5380188,
          mulheres: 6060887,
          comDado: 11441079,
          cobertura: 0.999,
        },
      });
    });

    it('arredonda a exatamente 2 casas (área) e 4 casas (cobertura)', () => {
      const pa = service.obter('2910800')!;
      expect(pa.areaKm2).toBe(1579.79); // 1579.789
      expect(pa.densidade).toBe(74.06); // 117000 / 1579.789 = 74.0605...
      expect(pa.sexo.cobertura).toBe(0.9996); // 116950 / 117000 = 0.99957...
    });

    it('devolve undefined para código inexistente', () => {
      expect(service.obter('0000000')).toBeUndefined();
    });

    it('devolve undefined para a linha "." mesmo existindo em mun_agg (R1)', () => {
      expect(service.obter('.')).toBeUndefined();
    });

    it('não divide por zero: população 0 dá cobertura 0', () => {
      db.exec(
        "INSERT INTO municipio VALUES ('9999999', 'Vazio', '11', 'vazio');" +
          "INSERT INTO mun_agg VALUES ('9999999', 0, 0, 0, 0, 0, 0, 0, 0, 0);",
      );
      const vazio = service.obter('9999999')!;
      expect(vazio.densidade).toBe(0);
      expect(vazio.sexo.cobertura).toBe(0);
    });
  });

  describe('arredondar', () => {
    it('arredonda meio para cima também nas fronteiras binárias', () => {
      expect(arredondar(1.005, 2)).toBe(1.01);
      expect(arredondar(1521.2015839, 2)).toBe(1521.2);
      expect(arredondar(0.99904, 4)).toBe(0.999);
      expect(arredondar(2.5, 0)).toBe(3);
    });
  });
});
