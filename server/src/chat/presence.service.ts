import { Injectable } from '@nestjs/common';

export type PresenceStatus = 'online' | 'afk' | 'offline';

const AFK_THRESHOLD_MS = 60_000; // 1 minute

interface SocketEntry {
  socketId: string;
  lastActivity: number; // epoch ms
}

@Injectable()
export class PresenceService {
  // userId → set of connected sockets with activity timestamps
  private readonly sockets = new Map<string, SocketEntry[]>();

  addSocket(userId: string, socketId: string) {
    const entries = this.sockets.get(userId) ?? [];
    entries.push({ socketId, lastActivity: Date.now() });
    this.sockets.set(userId, entries);
  }

  removeSocket(userId: string, socketId: string) {
    const entries = this.sockets.get(userId);
    if (!entries) return;
    const filtered = entries.filter((e) => e.socketId !== socketId);
    if (filtered.length === 0) {
      this.sockets.delete(userId);
    } else {
      this.sockets.set(userId, filtered);
    }
  }

  reportActivity(userId: string, socketId: string) {
    const entries = this.sockets.get(userId);
    if (!entries) return;
    const entry = entries.find((e) => e.socketId === socketId);
    if (entry) entry.lastActivity = Date.now();
  }

  getStatus(userId: string): PresenceStatus {
    const entries = this.sockets.get(userId);
    if (!entries || entries.length === 0) return 'offline';

    const now = Date.now();
    const anyActive = entries.some(
      (e) => now - e.lastActivity < AFK_THRESHOLD_MS,
    );
    return anyActive ? 'online' : 'afk';
  }

  getStatusBulk(userIds: string[]): Record<string, PresenceStatus> {
    const result: Record<string, PresenceStatus> = {};
    for (const id of userIds) {
      result[id] = this.getStatus(id);
    }
    return result;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.sockets.keys());
  }

  isConnected(userId: string): boolean {
    const entries = this.sockets.get(userId);
    return !!entries && entries.length > 0;
  }
}
