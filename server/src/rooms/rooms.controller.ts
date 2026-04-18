import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateRoomDto,
  InviteUserDto,
  UpdateRoomDto,
} from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user.id, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.rooms.listMine(user.id);
  }

  @Get('public')
  listPublic(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.rooms.listPublic(user.id, search?.trim() || undefined);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.rooms.getById(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.rooms.delete(user.id, id);
  }

  @Post(':id/join')
  @HttpCode(200)
  join(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.rooms.join(user.id, id);
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.rooms.leave(user.id, id);
  }

  @Post(':id/invite')
  @HttpCode(200)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.rooms.invite(user.id, id, dto.username);
  }

  @Get(':id/members')
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.rooms.listMembers(user.id, id);
  }

  @Post(':id/admins/:userId')
  @HttpCode(204)
  async makeAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ) {
    await this.rooms.setAdmin(user.id, id, targetId, true);
  }

  @Delete(':id/admins/:userId')
  @HttpCode(204)
  async revokeAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ) {
    await this.rooms.setAdmin(user.id, id, targetId, false);
  }

  @Post(':id/ban/:userId')
  @HttpCode(204)
  async ban(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ) {
    await this.rooms.ban(user.id, id, targetId);
  }

  @Delete(':id/ban/:userId')
  @HttpCode(204)
  async unban(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ) {
    await this.rooms.unban(user.id, id, targetId);
  }

  @Get(':id/bans')
  listBans(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.rooms.listBans(user.id, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  async kick(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetId: string,
  ) {
    await this.rooms.kick(user.id, id, targetId);
  }
}
