-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_messageId_fkey";

-- AlterTable: messageId nullable, add roomId + createdAt
ALTER TABLE "attachments" ALTER COLUMN "messageId" DROP NOT NULL;
ALTER TABLE "attachments" ADD COLUMN "roomId" UUID;
ALTER TABLE "attachments" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill roomId from message, then enforce NOT NULL
UPDATE "attachments" a
SET "roomId" = m."roomId"
FROM "messages" m
WHERE a."messageId" = m."id";

DELETE FROM "attachments" WHERE "roomId" IS NULL;

ALTER TABLE "attachments" ALTER COLUMN "roomId" SET NOT NULL;

-- AddForeignKeys
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index
CREATE INDEX "attachments_roomId_idx" ON "attachments"("roomId");
