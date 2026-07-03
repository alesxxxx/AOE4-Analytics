import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react'
import { countryFlag } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { useDebounce } from '@shared/hooks/useDebounce'
import {
  useSettings,
  useSetActiveAccount,
  useRemoveAccount,
  useSetProfile,
  usePlayerSearch,
  useSteamAvatar,
} from '../queries/useProfile'

/**
 * Switch between linked AoE4World accounts — a compact chip in the command bar
 * (Steam avatar + name). Switching changes the active account and re-scopes
 * dashboard, scout, history, and live polling.
 */
export function AccountSwitcher() {
  const { data: settings } = useSettings()
  const { data: avatar } = useSteamAvatar()
  const setActive = useSetActiveAccount()
  const remove = useRemoveAccount()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  if (!settings) return null
  const accounts = settings.accounts
  const active = settings.profileId
  const activeName =
    settings.playerName ?? accounts.find((a) => a.profileId === active)?.name ?? null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch or add account"
        className="flex h-9 w-full items-center gap-2 rounded-sm border border-border bg-black/20 px-1.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/70"
      >
        <AccountAvatar avatar={avatar ?? null} name={activeName} />
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
          {activeName ?? 'No account linked'}
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-sm border border-border bg-popover p-1 shadow-2xl shadow-black/50">
          {accounts.map((a) => (
            <div
              key={a.profileId}
              className={cn(
                'group flex items-center gap-2 rounded px-2 py-1.5 text-sm',
                a.profileId === active ? 'bg-primary/15 text-primary' : 'hover:bg-secondary/80',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (a.profileId !== active) setActive.mutate(a.profileId)
                  setOpen(false)
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    a.profileId === active ? 'text-primary' : 'text-transparent',
                  )}
                />
                <span className={cn('truncate', a.profileId === active && 'font-medium')}>
                  {a.name}
                </span>
              </button>
              {accounts.length > 1 && (
                <button
                  type="button"
                  title="Remove account"
                  onClick={() => remove.mutate(a.profileId)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="my-1 border-t border-primary/20" />

          {adding ? (
            <AddAccount
              onDone={() => {
                setAdding(false)
                setOpen(false)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add account
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Steam avatar when known, else the first initial on a gold plate. */
export function AccountAvatar({
  avatar,
  name,
  size = 'h-6 w-6',
}: {
  avatar: string | null
  name: string | null
  size?: string
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={cn(size, 'shrink-0 rounded-sm border border-primary/40 object-cover')}
      />
    )
  }
  return (
    <div
      className={cn(
        size,
        'flex shrink-0 items-center justify-center rounded-sm border border-primary/45 bg-primary/15 font-display text-xs font-bold text-primary',
      )}
    >
      {(name ?? 'R').charAt(0).toUpperCase()}
    </div>
  )
}

function AddAccount({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 350)
  const add = useSetProfile()
  const { data, isFetching } = usePlayerSearch(debounced)
  const hits = data?.ok ? data.data : []

  return (
    <div className="space-y-1 p-1">
      <div className="flex items-center gap-1.5 rounded border border-primary/25 bg-black/25 px-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player name..."
          className="h-8 flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>
      {query.trim().length >= 3 && (
        <div className="max-h-48 overflow-y-auto">
          {isFetching && hits.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Searching...</div>
          )}
          {hits.map((h) => (
            <button
              key={h.profileId}
              type="button"
              onClick={() => {
                add.mutate({ profileId: h.profileId, name: h.name }, { onSuccess: () => onDone() })
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary/80"
            >
              <span aria-hidden>{countryFlag(h.country)}</span>
              <span className="truncate">{h.name}</span>
            </button>
          ))}
          {!isFetching && hits.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No players found.</div>
          )}
        </div>
      )}
    </div>
  )
}
