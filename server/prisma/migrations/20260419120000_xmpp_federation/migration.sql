-- AlterTable: make email / passwordHash nullable for shadow (remote) users
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: federation fields on users
ALTER TABLE "users" ADD COLUMN "isRemote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "xmppJid" TEXT;
ALTER TABLE "users" ADD COLUMN "remoteDomain" TEXT;

CREATE UNIQUE INDEX "users_xmppJid_key" ON "users"("xmppJid");

-- AlterTable: MUC JID on rooms
ALTER TABLE "rooms" ADD COLUMN "xmppMucJid" TEXT;
CREATE UNIQUE INDEX "rooms_xmppMucJid_key" ON "rooms"("xmppMucJid");

-- CreateTable: federation peer stats
CREATE TABLE "federation_peers" (
    "id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stanzasIn" INTEGER NOT NULL DEFAULT 0,
    "stanzasOut" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "federation_peers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "federation_peers_domain_key" ON "federation_peers"("domain");
