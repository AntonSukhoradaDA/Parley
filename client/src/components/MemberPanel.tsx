import { useEffect, useState } from 'react'
import { listMembers, type RoomMember } from '@/lib/rooms'
import { getSocket } from '@/lib/socket'
import { usePresenceStore, type PresenceStatus } from '@/store/presence'

interface Props {
  roomId: string
}

export function MemberPanel({ roomId }: Props) {
  const [members, setMembers] = useState<RoomMember[]>([])
  const statuses = usePresenceStore((s) => s.statuses)

  useEffect(() => {
    listMembers(roomId).then(setMembers)

    // Request presence for this room
    const socket = getSocket()
    socket.emit('presence:getRoom', { roomId }, (bulk: Record<string, PresenceStatus>) => {
      if (bulk) usePresenceStore.getState().setBulkStatuses(bulk)
    })
  }, [roomId])

  // Listen for presence updates (already handled globally, but re-sort on change)
  const online = members.filter((m) => statuses[m.userId] === 'online')
  const afk = members.filter((m) => statuses[m.userId] === 'afk')
  const offline = members.filter(
    (m) => !statuses[m.userId] || statuses[m.userId] === 'offline',
  )

  return (
    <aside className="w-56 shrink-0 border-l border-hairline bg-vellum overflow-y-auto">
      <div className="px-4 py-4">
        <div className="eyebrow text-accent/80 mb-3">
          Members · {members.length}
        </div>

        {online.length > 0 && (
          <MemberSection label="Online" members={online} statuses={statuses} />
        )}
        {afk.length > 0 && (
          <MemberSection label="Away" members={afk} statuses={statuses} />
        )}
        {offline.length > 0 && (
          <MemberSection label="Offline" members={offline} statuses={statuses} />
        )}
      </div>
    </aside>
  )
}

function MemberSection({
  label,
  members,
  statuses,
}: {
  label: string
  members: RoomMember[]
  statuses: Record<string, PresenceStatus>
}) {
  return (
    <div className="mb-4">
      <div className="eyebrow text-mist mb-1.5">{label} — {members.length}</div>
      {members.map((m) => (
        <MemberRow key={m.userId} member={m} status={statuses[m.userId] ?? 'offline'} />
      ))}
    </div>
  )
}

function MemberRow({
  member,
  status,
}: {
  member: RoomMember
  status: PresenceStatus
}) {
  const dotColor =
    status === 'online'
      ? 'bg-moss'
      : status === 'afk'
        ? 'bg-yellow-500'
        : 'bg-stone'

  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      <div className="relative">
        <span className="w-6 h-6 rounded-full bg-slate border border-hairline flex items-center justify-center text-[10px] font-mono text-mist uppercase">
          {member.username.charAt(0)}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-vellum ${dotColor}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={`text-[13px] truncate block ${
            status === 'offline' ? 'text-mist' : 'text-chalk'
          }`}
        >
          {member.username}
        </span>
      </div>
      {member.role !== 'member' && (
        <span
          className={
            'text-[9px] font-mono uppercase tracking-wider ' +
            (member.role === 'owner' ? 'text-accent/70' : 'text-mist/70')
          }
        >
          {member.role}
        </span>
      )}
    </div>
  )
}
