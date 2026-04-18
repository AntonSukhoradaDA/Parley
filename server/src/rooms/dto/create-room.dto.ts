import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoomVisibility } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(RoomVisibility)
  @IsOptional()
  visibility?: RoomVisibility;
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(64)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(RoomVisibility)
  @IsOptional()
  visibility?: RoomVisibility;
}

export class InviteUserDto {
  @IsString()
  @MaxLength(64)
  username!: string;
}
