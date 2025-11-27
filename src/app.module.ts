import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { UserModule } from './user/user.module';
import { ContactModule } from './contact/contact.module';
import { AddressModule } from './address/address.module';
import { BukuModule } from './buku/buku.module';

@Module({
  imports: [CommonModule, UserModule, ContactModule, AddressModule, BukuModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
