import { useEffect, useState } from 'react'
import { listMembers, type Room, type RoomMember } from '@/lib/rooms'
import { getSocket } from '@/lib/socket'
import { usePresenceStore, type PresenceStatus } from '@/store/presence'
import { PresenceDot } from '@/components/ui'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons'

type ManageTab = 'members' | 'admins' | 'banned' | 'invitations' | 'settings'

interface Props {
  room: Room
  onOpenManage: (tab: ManageTab) => void
  variant?: 'desktop' | 'mobile'
  onClose?: () => void
}

export function MemberPanel({ room, onOpenManage, variant = 'desktop', onClose }: Props) {
  const [members, setMembers] = useState<RoomMember[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const statuses = usePresenceStore((s) => s.statuses)

  useEffect(() => {
    listMembers(room.id).then(setMembers)

    const socket = getSocket()
    socket.emit('presence:getRoom', { roomId: room.id }, (bulk: Record<string, PresenceStatus>) => {
      if (bulk) usePresenceStore.getState().setBulkStatuses(bulk)
    })
  }, [room.id])

  if (collapsed && variant === 'desktop') {
    return (
      <aside className="w-10 shrink-0 border-l border-hairline bg-vellum flex flex-col items-center py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="parley-icon-button"
          title="Expand members"
          aria-label="Expand members panel"
        >
          <ChevronLeftIcon width={12} height={12} />
        </button>
        <div
          className="mt-3 eyebrow text-mist"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Members · {members.length}
        </div>
      </aside>
    )
  }

  const owner = members.find((m) => m.role === 'owner')
  const admins = members.filter((m) => m.role === 'admin')
  const sorted = [...members].sort((a, b) => {
    const rank: Record<PresenceStatus, number> = { online: 0, afk: 1, offline: 2 }
    const sa = statuses[a.userId] ?? 'offline'
    const sb = statuses[b.userId] ?? 'offline'
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb]
    return a.username.localeCompare(b.username)
  })

  const isAdminPlus = room.role === 'owner' || room.role === 'admin'
  const canInvite = isAdminPlus && room.visibility === 'private'

  const rootCls =
    variant === 'mobile'
      ? 'w-full h-full bg-vellum flex flex-col'
      : 'w-60 shrink-0 border-l border-hairline bg-vellum flex flex-col'

  return (
    <aside className={rootCls}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
        <div className="eyebrow text-mist">Context</div>
        {variant === 'mobile' ? (
          <button
            type="button"
            onClick={onClose}
            className="parley-icon-button !w-7 !h-7"
            title="Close"
            aria-label="Close members panel"
          >
            <CloseIcon width={13} height={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="parley-icon-button !w-6 !h-6"
            title="Collapse"
            aria-label="Collapse members panel"
          >
            <ChevronRightIcon width={12} height={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="eyebrow text-mist mb-2">Room info</div>
        <div className="text-[13px] text-chalk mb-1">
          {room.visibility === 'public' ? 'Public room' : 'Private room'}
        </div>
        {owner && (
          <div className="text-[13px] text-bone mb-4">
            <span className="text-mist">Owner: </span>
            <span className="text-chalk">{owner.username}</span>
          </div>
        )}

        <SectionHeader
          label={`Admins - ${admins.length}`}
          onClick={isAdminPlus ? () => onOpenManage('admins') : undefined}
        />
        {admins.length > 0 ? (
          <div className="mb-5">
            {admins.map((m) => (
              <div key={m.userId} className="text-[13px] text-chalk py-0.5">
                <span className="text-mist font-mono">·</span> {m.username}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 text-[12px] text-mist/70 italic">none</div>
        )}

        <SectionHeader
          label={`Members - ${members.length}`}
          onClick={() => onOpenManage('members')}
        />
        <div className="-mx-1 mb-2">
          {sorted.map((m) => (
            <MemberRow key={m.userId} member={m} status={statuses[m.userId] ?? 'offline'} />
          ))}
        </div>

        {isAdminPlus && (
          <>
            <div className="h-px bg-hairline my-4" />
            <button
              type="button"
              onClick={() => onOpenManage('banned')}
              className="text-[12px] font-mono uppercase tracking-wider text-mist hover:text-chalk transition-colors"
            >
              View banned users →
            </button>
          </>
        )}
      </div>

      <div className="border-t border-hairline px-4 py-3 space-y-2">
        {canInvite && (
          <button
            type="button"
            onClick={() => onOpenManage('invitations')}
            className="parley-button-ghost w-full !py-1.5 !text-[13px]"
          >
            Invite user
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenManage(isAdminPlus ? 'settings' : 'members')}
          className="parley-button-ghost w-full !py-1.5 !text-[13px]"
        >
          Manage room
        </button>
      </div>
    </aside>
  )
}

function SectionHeader({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) {
    return <div className="eyebrow text-mist mb-1.5">{label}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="eyebrow text-mist hover:text-chalk transition-colors mb-1.5 inline-flex items-center gap-1.5"
    >
      {label}
      <span className="text-[9px]">↗</span>
    </button>
  )
}

function MemberRow({ member, status }: { member: RoomMember; status: PresenceStatus }) {
  const label = status === 'afk' ? 'AFK' : status === 'offline' ? 'offline' : null

  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <PresenceDot status={status} />
      <span
        className={`text-[13px] truncate flex-1 ${
          status === 'offline' ? 'text-mist' : 'text-chalk'
        }`}
      >
        {member.username}
      </span>
      {label && (
        <span className="text-[10px] font-mono uppercase tracking-wider text-mist/70">{label}</span>
      )}
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
