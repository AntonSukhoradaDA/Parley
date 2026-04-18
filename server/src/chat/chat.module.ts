import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { MessagesModule } from '../messages/messages.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'parley-dev-secret-change-in-production'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    MessagesModule,
    RoomsModule,
  ],
  providers: [ChatGateway, PresenceService],
  exports: [PresenceService],
})
export class ChatModule {}
