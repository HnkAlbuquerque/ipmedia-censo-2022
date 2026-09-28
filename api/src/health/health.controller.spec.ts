import { Test } from '@nestjs/testing';
import Database from 'better-sqlite3';
import { DbService } from '../db/db.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let db: Database.Database;

  beforeEach(async () => {
    // DbService falso: banco em memória com uma mun_agg mínima, sem bootstrap.
    db = new Database(':memory:');
    db.exec(
      'CREATE TABLE mun_agg (cd_mun TEXT PRIMARY KEY);' +
        "INSERT INTO mun_agg VALUES ('.'), ('3550308'), ('3304557');",
    );

    const modulo = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DbService, useValue: { db } }],
    }).compile();

    controller = modulo.get(HealthController);
  });

  afterEach(() => {
    db.close();
  });

  it('responde status ok com a versão do SQLite no formato x.y.z', () => {
    const resposta = controller.health();

    expect(resposta.status).toBe('ok');
    expect(resposta.sqlite).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('responde a contagem de linhas de mun_agg', () => {
    expect(controller.health().municipios).toBe(3);
  });
});
