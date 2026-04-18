import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  history(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.history(
      roomId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
