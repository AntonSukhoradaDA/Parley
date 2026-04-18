import { useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import { createRoom, type RoomVisibility } from '@/lib/rooms'
import { Modal } from './Modal'
import { buttonClass, FormField, inputClass } from './AuthCard'

export function CreateRoomModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<RoomVisibility>('public')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setDescription('')
    setVisibility('public')
    setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await createRoom({ name, description: description || undefined, visibility })
      reset()
      onCreated(res.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      eyebrow="New parley"
      title="Open a room"
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Name" hint="2–64 chars">
          <input
            type="text"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={64}
            placeholder="general, ledger, the-quiet-room…"
            required
            autoFocus
          />
        </FormField>
        <FormField label="Description" hint="optional · 500 chars">
          <textarea
            className={inputClass + ' min-h-[88px]'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="A line or two on what this room is about."
          />
        </FormField>
        <FormField label="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <VisibilityOption
              active={visibility === 'public'}
              onClick={() => setVisibility('public')}
              label="Public"
              hint="anyone may join"
              glyph="#"
            />
            <VisibilityOption
              active={visibility === 'private'}
              onClick={() => setVisibility('private')}
              label="Private"
              hint="invite only"
              glyph="◆"
            />
          </div>
        </FormField>
        {error && (
          <div
            className="text-sm text-rust mb-4 font-mono border-l-2 border-rust pl-3 py-1"
            role="alert"
          >
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Opening…' : 'Open the room →'}
        </button>
      </form>
    </Modal>
  )
}

function VisibilityOption({
  active,
  onClick,
  label,
  hint,
  glyph,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
  glyph: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'text-left rounded-[6px] px-3 py-3 border transition-colors ' +
        (active
          ? 'border-accent bg-slate text-paper'
          : 'border-hairline-strong bg-transparent text-bone hover:border-mist hover:text-paper')
      }
    >
      <div className="flex items-baseline gap-2">
        <span className={'font-mono ' + (active ? 'text-accent' : 'text-mist')}>{glyph}</span>
        <span className="text-base font-medium tracking-tight leading-none">{label}</span>
      </div>
      <div className="eyebrow mt-1.5">{hint}</div>
    </button>
  )
}
