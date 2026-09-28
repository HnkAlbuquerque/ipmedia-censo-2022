import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = modulo.get(HealthController);
  });

  it('responde status ok com a versão do SQLite no formato x.y.z', () => {
    const resposta = controller.health();

    expect(resposta.status).toBe('ok');
    expect(resposta.sqlite).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
