import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PersonalChatsService } from './personal-chats.service';

@UseGuards(JwtAuthGuard)
@Controller('personal-chats')
export class PersonalChatsController {
  constructor(private readonly chats: PersonalChatsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chats.list(user.id);
  }

  @Post(':userId')
  openOrCreate(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) otherUserId: string,
  ) {
    return this.chats.openOrCreate(user.id, otherUserId);
  }
}
