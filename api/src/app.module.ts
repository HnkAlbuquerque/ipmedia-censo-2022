import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';

@Module({
  // A ordem aqui não importa: o Nest executa todos os onModuleInit (o
  // bootstrap do DbService incluso) antes de listen(), então o health só
  // responde com os dados prontos.
  imports: [DbModule, HealthModule],
})
export class AppModule {}
