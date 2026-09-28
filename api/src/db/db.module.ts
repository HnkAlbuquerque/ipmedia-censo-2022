import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

/**
 * Global para que qualquer módulo injete `DbService` sem reimportar.
 * O bootstrap roda no `onModuleInit` do service, antes de a porta abrir.
 */
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
