import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';

class SendRequestDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.friends.listFriends(user.id);
  }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser) {
    return this.friends.listRequests(user.id);
  }

  @Post('request')
  sendRequest(@CurrentUser() user: AuthUser, @Body() dto: SendRequestDto) {
    return this.friends.sendRequest(user.id, dto.username, dto.message);
  }

  @Post('accept/:id')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.friends.accept(user.id, id);
  }

  @Delete('reject/:id')
  @HttpCode(204)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.friends.reject(user.id, id);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.friends.removeFriend(user.id, userId);
  }
}
