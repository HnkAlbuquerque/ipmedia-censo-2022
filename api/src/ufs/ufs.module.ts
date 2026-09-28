import { Module } from '@nestjs/common';
import { UfsController } from './ufs.controller';
import { UfsService } from './ufs.service';

/** Lista de UFs, agregado e ranking de densidade por estado. `DbService` vem do `DbModule` global. */
@Module({
  controllers: [UfsController],
  providers: [UfsService],
})
export class UfsModule {}
