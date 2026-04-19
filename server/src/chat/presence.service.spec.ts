import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  describe('getStatus', () => {
    it('returns offline when user has no sockets', () => {
      expect(service.getStatus('user1')).toBe('offline');
    });

    it('returns online immediately after addSocket', () => {
      service.addSocket('user1', 'sock1');
      expect(service.getStatus('user1')).toBe('online');
    });

    it('returns offline after all sockets are removed', () => {
      service.addSocket('user1', 'sock1');
      service.removeSocket('user1', 'sock1');
      expect(service.getStatus('user1')).toBe('offline');
    });

    it('returns afk when socket activity is older than 60s', () => {
      service.addSocket('user1', 'sock1');
      // Manually set lastActivity to 2 minutes ago
      const entries = (service as any).sockets.get('user1');
      entries[0].lastActivity = Date.now() - 120_000;
      expect(service.getStatus('user1')).toBe('afk');
    });

    it('returns online if at least one of multiple tabs is active', () => {
      service.addSocket('user1', 'sock1');
      service.addSocket('user1', 'sock2');
      // Make sock1 stale
      const entries = (service as any).sockets.get('user1');
      entries[0].lastActivity = Date.now() - 120_000;
      // sock2 is still fresh
      expect(service.getStatus('user1')).toBe('online');
    });

    it('returns afk only when ALL tabs are idle', () => {
      service.addSocket('user1', 'sock1');
      service.addSocket('user1', 'sock2');
      const entries = (service as any).sockets.get('user1');
      entries[0].lastActivity = Date.now() - 120_000;
      entries[1].lastActivity = Date.now() - 120_000;
      expect(service.getStatus('user1')).toBe('afk');
    });
  });

  describe('reportActivity', () => {
    it('moves user from afk to online', () => {
      service.addSocket('user1', 'sock1');
      const entries = (service as any).sockets.get('user1');
      entries[0].lastActivity = Date.now() - 120_000;
      expect(service.getStatus('user1')).toBe('afk');

      service.reportActivity('user1', 'sock1');
      expect(service.getStatus('user1')).toBe('online');
    });

    it('does nothing for unknown user', () => {
      // Should not throw
      service.reportActivity('unknown', 'sock1');
    });
  });

  describe('multi-tab lifecycle', () => {
    it('stays online when one of two tabs disconnects', () => {
      service.addSocket('user1', 'sock1');
      service.addSocket('user1', 'sock2');
      service.removeSocket('user1', 'sock1');
      expect(service.getStatus('user1')).toBe('online');
      expect(service.isConnected('user1')).toBe(true);
    });

    it('goes offline when last tab disconnects', () => {
      service.addSocket('user1', 'sock1');
      service.addSocket('user1', 'sock2');
      service.removeSocket('user1', 'sock1');
      service.removeSocket('user1', 'sock2');
      expect(service.getStatus('user1')).toBe('offline');
      expect(service.isConnected('user1')).toBe(false);
    });
  });

  describe('getStatusBulk', () => {
    it('returns statuses for multiple users', () => {
      service.addSocket('user1', 'sock1');
      // user2 not connected
      const result = service.getStatusBulk(['user1', 'user2']);
      expect(result).toEqual({
        user1: 'online',
        user2: 'offline',
      });
    });
  });

  describe('getOnlineUserIds', () => {
    it('returns all users with at least one socket', () => {
      service.addSocket('user1', 'sock1');
      service.addSocket('user2', 'sock2');
      const ids = service.getOnlineUserIds();
      expect(ids).toContain('user1');
      expect(ids).toContain('user2');
      expect(ids).toHaveLength(2);
    });
  });
});
