import { Controller, Get } from '@nestjs/common';
import Database from 'better-sqlite3';

export interface HealthResposta {
  status: 'ok';
  sqlite: string;
}

@Controller('health')
export class HealthController {
  /**
   * Abre um banco em memória a cada chamada para provar que o módulo nativo
   * do better-sqlite3 carrega na imagem. A conexão é fechada em seguida.
   */
  @Get()
  health(): HealthResposta {
    const db = new Database(':memory:');
    try {
      const linha = db.prepare('SELECT sqlite_version() AS versao').get() as {
        versao: string;
      };
      return { status: 'ok', sqlite: linha.versao };
    } finally {
      db.close();
    }
  }
}
