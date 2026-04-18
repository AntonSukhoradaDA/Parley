import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.users.deleteAccount(user.id);
  }

  @Post('ban/:userId')
  @HttpCode(204)
  async ban(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    await this.users.banUser(user.id, userId);
  }

  @Delete('ban/:userId')
  @HttpCode(204)
  async unban(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    await this.users.unbanUser(user.id, userId);
  }

  @Get('bans')
  listBans(@CurrentUser() user: AuthUser) {
    return this.users.listBannedUsers(user.id);
  }
}
