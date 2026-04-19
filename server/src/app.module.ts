import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { FriendsModule } from './friends/friends.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MessagesModule } from './messages/messages.module';
import { PersonalChatsModule } from './personal-chats/personal-chats.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';
import { XmppModule } from './xmpp/xmpp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    MailModule,
    UsersModule,
    AuthModule,
    FriendsModule,
    RoomsModule,
    MessagesModule,
    PersonalChatsModule,
    AttachmentsModule,
    XmppModule,
    ChatModule,
  ],
})
export class AppModule {}
