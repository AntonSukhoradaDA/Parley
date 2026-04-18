import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

@Injectable()
export class AttachmentsService {
  private readonly filesDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    config: ConfigService,
  ) {
    this.filesDir = config.get<string>('FILES_DIR', '/var/parley/files');
    if (!existsSync(this.filesDir)) {
      mkdirSync(this.filesDir, { recursive: true });
    }
  }

  async upload(
    userId: string,
    roomId: string,
    file: Express.Multer.File,
    comment?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const membership = await this.rooms.getMembership(roomId, userId);
    if (!membership) throw new BadRequestException('Not a member of this room');

    const isImage = file.mimetype.startsWith('image/');
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (file.size > limit) {
      throw new BadRequestException(
        isImage ? 'Image exceeds 3 MB limit' : 'File exceeds 20 MB limit',
      );
    }

    const storedName = `${randomUUID()}`;
    const storagePath = join(this.filesDir, storedName);
    await writeFile(storagePath, file.buffer);

    return this.prisma.attachment.create({
      data: {
        uploaderId: userId,
        roomId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        storagePath,
        comment: comment?.trim() || null,
      },
      select: {
        id: true,
        filename: true,
        mimetype: true,
        size: true,
        comment: true,
      },
    });
  }

  async attachToMessage(
    attachmentIds: string[],
    messageId: string,
    roomId: string,
    userId: string,
  ) {
    if (!attachmentIds.length) return;
    const found = await this.prisma.attachment.findMany({
      where: { id: { in: attachmentIds } },
      select: { id: true, uploaderId: true, roomId: true, messageId: true },
    });
    for (const a of found) {
      if (a.uploaderId !== userId) {
        throw new BadRequestException("Cannot use another user's attachment");
      }
      if (a.roomId !== roomId) {
        throw new BadRequestException(
          'Attachment does not belong to this room',
        );
      }
      if (a.messageId) {
        throw new BadRequestException('Attachment already linked');
      }
    }
    await this.prisma.attachment.updateMany({
      where: { id: { in: attachmentIds }, messageId: null, uploaderId: userId },
      data: { messageId },
    });
  }

  async streamForDownload(attachmentId: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const membership = await this.rooms.getMembership(
      attachment.roomId,
      userId,
    );
    if (!membership) throw new NotFoundException('Attachment not found');

    if (!existsSync(attachment.storagePath)) {
      throw new NotFoundException('File missing on disk');
    }

    return {
      stream: createReadStream(attachment.storagePath),
      filename: attachment.filename,
      mimetype: attachment.mimetype,
      size: attachment.size,
    };
  }

  async deleteOrphans(olderThanMs = 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - olderThanMs);
    const orphans = await this.prisma.attachment.findMany({
      where: { messageId: null, createdAt: { lt: cutoff } },
    });
    for (const o of orphans) {
      try {
        unlinkSync(o.storagePath);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.attachment.deleteMany({
      where: { id: { in: orphans.map((o) => o.id) } },
    });
  }
}
