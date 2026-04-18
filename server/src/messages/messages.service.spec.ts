import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonalChatsService } from '../personal-chats/personal-chats.service';

// ─── In-memory fixture ────────────────────────────────────
// Simulate a 3-year-old room with 100,000 messages and prove the cursor-based
// `history()` paginator can walk back to the very first message without gaps
// or duplicates — matching the spec requirement of infinite-scroll through
// large history.

interface FakeMsg {
  id: string;
  roomId: string;
  createdAt: Date;
  // Fields referenced by MESSAGE_SELECT — unused values are fine as nulls.
  content: string;
  editedAt: null;
  replyToId: null;
  sender: { id: string; username: string };
  replyTo: null;
  attachments: never[];
}

const TOTAL = 100_000;
const ROOM_ID = 'room-under-test';
const PAGE_SIZE = 50;

function buildFixture(): FakeMsg[] {
  // Oldest first (index 0 = 3 years ago), newest last.
  const base = Date.now() - 3 * 365 * 24 * 60 * 60 * 1000;
  const arr: FakeMsg[] = new Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) {
    arr[i] = {
      id: `m${i.toString().padStart(6, '0')}`,
      roomId: ROOM_ID,
      createdAt: new Date(base + i * 60_000), // 1 minute apart
      content: `msg ${i}`,
      editedAt: null,
      replyToId: null,
      sender: { id: 'u1', username: 'alice' },
      replyTo: null,
      attachments: [],
    };
  }
  return arr;
}

function makePrismaMock(all: FakeMsg[]) {
  // Pre-sort descending by createdAt once — this matches the service's
  // orderBy and lets the mock's per-call cost be O(log N) instead of O(N log N).
  const sortedDesc = [...all].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const indexById = new Map<string, number>();
  sortedDesc.forEach((m, i) => indexById.set(m.id, i));

  return {
    message: {
      findMany: jest.fn(
        async (args: {
          where: { roomId: string };
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const { where, take, cursor, skip = 0 } = args;
          if (where.roomId !== ROOM_ID) return [];
          let start = 0;
          if (cursor) {
            const idx = indexById.get(cursor.id);
            if (idx === undefined) return [];
            start = idx + skip;
          }
          return sortedDesc.slice(start, start + take);
        },
      ),
    },
  };
}

describe('MessagesService.history() — 100K message infinite scroll', () => {
  let service: MessagesService;
  let all: FakeMsg[];

  beforeAll(async () => {
    all = buildFixture();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: makePrismaMock(all) },
        // history() doesn't touch PersonalChatsService, but the constructor needs it.
        { provide: PersonalChatsService, useValue: {} },
      ],
    }).compile();

    service = module.get(MessagesService);
  });

  it('paginates through the full 100K history in order with no gaps or duplicates', async () => {
    const seen = new Set<string>();
    const orderedIds: string[] = [];
    let cursor: string | undefined = undefined;
    let pages = 0;

    // Hard upper bound on iterations to guarantee the test terminates even
    // if pagination regresses into an infinite loop.
    const MAX_PAGES = Math.ceil(TOTAL / PAGE_SIZE) + 10;

    while (true) {
      pages++;
      if (pages > MAX_PAGES) {
        throw new Error(
          `Exceeded ${MAX_PAGES} pages — possible pagination loop`,
        );
      }

      const res = await service.history(ROOM_ID, cursor);

      // Each page arrives oldest-first within itself, and pages walk from
      // newest to oldest. Prepend the page as a block to keep orderedIds
      // globally ascending.
      for (const m of res.messages) {
        if (seen.has(m.id)) {
          throw new Error(`Duplicate id ${m.id} on page ${pages}`);
        }
        seen.add(m.id);
      }
      orderedIds.unshift(...res.messages.map((m) => m.id));

      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }

    expect(seen.size).toBe(TOTAL);
    // First id collected (newest on page 1) is the latest message; last (oldest
    // on the final page) is the very first message in the room.
    expect(orderedIds[0]).toBe('m000000');
    expect(orderedIds[orderedIds.length - 1]).toBe(
      `m${(TOTAL - 1).toString().padStart(6, '0')}`,
    );
    expect(pages).toBe(Math.ceil(TOTAL / PAGE_SIZE));
  }, 60_000);

  it('returns nextCursor=null on the final page and stops cleanly', async () => {
    // Walk to the penultimate page then request one more to land exactly on the
    // last, and assert we're told there's nothing beyond it.
    let cursor: string | undefined = undefined;
    let pages = 0;
    const MAX_PAGES = Math.ceil(TOTAL / PAGE_SIZE) + 10;
    while (true) {
      pages++;
      if (pages > MAX_PAGES) throw new Error('pagination loop');
      const res = await service.history(ROOM_ID, cursor);
      if (!res.nextCursor) {
        expect(res.messages.length).toBeGreaterThan(0);
        // Oldest ever message must be in the final page.
        expect(res.messages[0].id).toBe('m000000');
        return;
      }
      cursor = res.nextCursor;
    }
  }, 60_000);
});
