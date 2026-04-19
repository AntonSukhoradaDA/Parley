import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { XmppBridgeService } from './xmpp-bridge.service';
import { XmppConfig } from './xmpp.config';
import { XmppStatsService } from './xmpp-stats.service';
import { XmppInboundService } from './xmpp-inbound.service';
import { XmppAdminController } from './xmpp-admin.controller';
import { XmppAuthController } from './xmpp-auth.controller';

@Module({
  imports: [PrismaModule],
  controllers: [XmppAdminController, XmppAuthController],
  providers: [
    XmppConfig,
    XmppStatsService,
    XmppBridgeService,
    XmppInboundService,
  ],
  exports: [
    XmppBridgeService,
    XmppInboundService,
    XmppStatsService,
    XmppConfig,
  ],
})
export class XmppModule {}
