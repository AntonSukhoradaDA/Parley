import { Module } from '@nestjs/common';
import { PersonalChatsController } from './personal-chats.controller';
import { PersonalChatsService } from './personal-chats.service';

@Module({
  controllers: [PersonalChatsController],
  providers: [PersonalChatsService],
  exports: [PersonalChatsService],
})
export class PersonalChatsModule {}
