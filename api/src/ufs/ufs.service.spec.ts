import Database from 'better-sqlite3';
import { DbService } from '../db/db.service';
import { UfsService } from './ufs.service';

/**
 * Lista, agregado e ranking sem o censo.sqlite: banco em memória com `uf`,
 * `municipio` e `mun_agg` mínimos. A UF 43 tem 3 municípios mais a linha
 * `'.'`, para exercitar a ordem por densidade, o desempate por `cd_mun`, a
 * posição, o agregado com `'.'` dentro e a página além do fim. Os valores do
 * arquivo real são conferidos no e2e.
 */
describe('UfsService', () => {
  let db: Database.Database;
  let service: UfsService;

  // [cd_mun, nm_mun, cd_uf, populacao, area_km2]
  const municipios: [string, string, string, number, number][] = [
    // Densidade 100, 200 e 200: os dois empatados saem em ordem de cd_mun,
    // e o de código maior tem população maior, para provar que o desempate
    // não é por população.
    ['4300001', 'Alfa', '43', 1000, 10],
    ['4300003', 'Gama', '43', 4000, 20],
    ['4300002', 'Beta', '43', 2000, 10],
    // Lagoas do RS (R1): entra na população e na área, sai da lista e da contagem.
    ['.', '', '43', 0, 13085.9],
    ['3500001', 'Delta', '35', 500, 4],
  ];

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE uf (cd_uf TEXT PRIMARY KEY, nm_uf TEXT NOT NULL);
      CREATE TABLE municipio (
        cd_mun TEXT PRIMARY KEY, nm_mun TEXT NOT NULL, cd_uf TEXT NOT NULL,
        nm_mun_busca TEXT
      );
      CREATE TABLE mun_agg (
        cd_mun TEXT PRIMARY KEY, setores_total INTEGER, setores_urbanos INTEGER,
        setores_rurais INTEGER, setores_nao_informados INTEGER, populacao INTEGER,
        area_km2 REAL, homens INTEGER, mulheres INTEGER, moradores INTEGER
      );
      INSERT INTO uf VALUES ('43', 'Rio Grande do Sul'), ('35', 'São Paulo'),
        ('28', 'Sergipe'), ('15', 'Pará'), ('25', 'Paraíba'), ('41', 'Paraná'),
        ('33', 'Rio de Janeiro'), ('24', 'Rio Grande do Norte'), ('12', 'Acre'),
        ('17', 'Tocantins');
    `);
    const inserirMun = db.prepare('INSERT INTO municipio VALUES (?, ?, ?, ?)');
    const inserirAgg = db.prepare(
      'INSERT INTO mun_agg VALUES (?, 1, 1, 0, 0, ?, ?, 0, 0, 0)',
    );
    for (const [cd, nome, uf, pop, area] of municipios) {
      inserirMun.run(cd, nome, uf, nome.toLowerCase());
      inserirAgg.run(cd, pop, area);
    }
    service = new UfsService({ db } as DbService);
  });

  afterEach(() => {
    db.close();
  });

  describe('listar', () => {
    it('cruza a tabela uf com a sigla de UFS', () => {
      expect(service.listar()).toEqual(
        expect.arrayContaining([
          { cdUf: '43', sigla: 'RS', nome: 'Rio Grande do Sul' },
          { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
        ]),
      );
      expect(service.listar()).toHaveLength(10);
    });

    it('ordena por nome em português, não por bytes', () => {
      expect(service.listar().map((u) => u.nome)).toEqual([
        'Acre',
        'Pará', // bytes poriam Paraná < Paraíba < Pará
        'Paraíba',
        'Paraná',
        'Rio de Janeiro', // bytes poriam "Rio G" antes de "Rio d"
        'Rio Grande do Norte',
        'Rio Grande do Sul',
        'São Paulo', // bytes poriam Sergipe antes de São Paulo
        'Sergipe',
        'Tocantins',
      ]);
    });
  });

  describe('obter', () => {
    it('soma população e área incluindo a linha "." e conta municípios sem ela (R1, R7)', () => {
      expect(service.obter('43')).toEqual({
        cdUf: '43',
        sigla: 'RS',
        nome: 'Rio Grande do Sul',
        populacao: 7000,
        areaKm2: 13125.9, // 10 + 20 + 10 + 13085.9
        densidade: 0.53, // 7000 / 13125.9 = 0.5333...
        totalMunicipios: 3,
      });
    });

    it('calcula a densidade sobre a área crua e arredonda a 2 casas', () => {
      db.exec("UPDATE mun_agg SET area_km2 = 1.2345678 WHERE cd_mun = '3500001'");
      const sp = service.obter('35')!;
      expect(sp.areaKm2).toBe(1.23);
      expect(sp.densidade).toBe(405.0); // 500 / 1.2345678 = 405.000...; sobre 1.23 daria 406.5
      expect(sp.totalMunicipios).toBe(1);
    });

    it('devolve undefined para UF inexistente na tabela uf', () => {
      expect(service.obter('99')).toBeUndefined();
      expect(service.obter('abc')).toBeUndefined();
    });

    it('não divide por zero: UF sem área dá densidade 0', () => {
      db.exec("INSERT INTO uf VALUES ('53', 'Distrito Federal')");
      expect(service.obter('53')).toEqual({
        cdUf: '53',
        sigla: 'DF',
        nome: 'Distrito Federal',
        populacao: 0,
        areaKm2: 0,
        densidade: 0,
        totalMunicipios: 0,
      });
    });
  });

  describe('ranking', () => {
    it('ordena por densidade decrescente com desempate por cd_mun e calcula a posição (R6)', () => {
      expect(service.ranking('43', 1, 50)).toEqual({
        total: 3,
        page: 1,
        pageSize: 50,
        itens: [
          { posicao: 1, cdMun: '4300002', nome: 'Beta', populacao: 2000, areaKm2: 10, densidade: 200 },
          { posicao: 2, cdMun: '4300003', nome: 'Gama', populacao: 4000, areaKm2: 20, densidade: 200 },
          { posicao: 3, cdMun: '4300001', nome: 'Alfa', populacao: 1000, areaKm2: 10, densidade: 100 },
        ],
      });
    });

    it('nunca lista a linha "." (R1)', () => {
      const { itens, total } = service.ranking('43', 1, 100)!;
      expect(total).toBe(3);
      expect(itens.some((i) => i.cdMun === '.' || i.nome === '')).toBe(false);
    });

    it('pagina com posição contínua entre as páginas', () => {
      const p1 = service.ranking('43', 1, 2)!;
      const p2 = service.ranking('43', 2, 2)!;
      expect(p1.itens.map((i) => i.posicao)).toEqual([1, 2]);
      expect(p2.itens.map((i) => i.posicao)).toEqual([3]);
      expect(p2).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(p2.itens[0].cdMun).toBe('4300001');
    });

    it('página além do fim devolve itens vazios com o total certo', () => {
      expect(service.ranking('43', 99, 50)).toEqual({
        total: 3,
        page: 99,
        pageSize: 50,
        itens: [],
      });
    });

    it('arredonda área e densidade a 2 casas só na resposta (R7)', () => {
      db.exec("UPDATE mun_agg SET area_km2 = 1.2345678 WHERE cd_mun = '3500001'");
      const [delta] = service.ranking('35', 1, 50)!.itens;
      expect(delta.areaKm2).toBe(1.23);
      expect(delta.densidade).toBe(405.0);
    });

    it('devolve undefined para UF inexistente', () => {
      expect(service.ranking('99', 1, 50)).toBeUndefined();
    });
  });
});
