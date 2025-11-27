import { Module } from '@nestjs/common';
import { BukuService } from './buku.service';
import { BukuController } from './buku.controller';

@Module({
  providers: [BukuService],
  controllers: [BukuController],
})
export class BukuModule {}
