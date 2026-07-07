import { useState } from 'react'
import { Loader2, Gamepad2, ChevronRight } from 'lucide-react'
import { ipc } from '@shared/ipc'
import type { SteamAccount } from '@domain/steamAccounts'
import type { PlayerSearchHit } from '@ipc/contract'
import { PlayerSearch } from '../components/PlayerSearch'
import { useSetProfile } from '../queries/useProfile'

/** First-run gate: resolve the user's AoE4 name to a profile and save it. */
export function Onboarding() {
  const setProfile = useSetProfile()

  const save = (hit: { profileId: number; name: string }) =>
    setProfile.mutate({ profileId: hit.profileId, name: hit.name })

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
      <div className="rts-menu-card w-full max-w-md space-y-6 rounded-lg border border-primary/25 p-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-primary/45 bg-gradient-to-br from-primary to-primary/50 text-xl font-black text-primary-foreground">
            R
          </div>
          <h1 className="text-2xl font-black tracking-[0.08em] text-primary">RTSLytics</h1>
          <p className="text-sm text-muted-foreground">
            Enter your in-game Age of Empires IV name. We&apos;ll pull your ranks and recent games
            from AoE4World; no account needed.
          </p>
        </div>

        <PlayerSearch autoFocus placeholder="Your AoE4 name..." onSelect={save} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-primary/25" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-primary/25" />
        </div>

        <SteamConnect onResolved={save} />

        {setProfile.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
        {setProfile.isError && (
          <p className="text-center text-sm text-destructive">Could not save profile. Try again.</p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Multiple accounts share your name? Pick the one matching your rank and region.
        </p>
      </div>
    </div>
  )
}

/** Detects local Steam accounts and resolves the selected one to an AoE4World profile. */
function SteamConnect({ onResolved }: { onResolved: (hit: PlayerSearchHit) => void }) {
  const [accounts, setAccounts] = useState<SteamAccount[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detect = async () => {
    setLoading(true)
    setError(null)
    try {
      const accs = await ipc.detectSteamAccounts()
      setAccounts(accs)
      if (accs.length === 0) {
        setError('No Steam accounts found on this PC. If you play on Xbox, search by name above.')
      }
    } catch {
      setError('Could not detect Steam accounts. Try again, or search by name above.')
    } finally {
      setLoading(false)
    }
  }

  const pick = async (acc: SteamAccount) => {
    setResolvingId(acc.steamId)
    setError(null)
    try {
      const res = await ipc.searchPlayers(acc.steamId)
      if (res.ok && res.data.length > 0) onResolved(res.data[0]!)
      else setError(`No AoE4World profile for ${acc.personaName ?? acc.accountName ?? acc.steamId}.`)
    } catch {
      setError('Profile lookup failed. Try again, or search by name above.')
    } finally {
      setResolvingId(null)
    }
  }

  if (!accounts) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={detect}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-black/20 px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary/80 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gamepad2 className="h-4 w-4" />
          )}
          Connect with Steam
        </button>
        {error && <p className="text-center text-xs text-muted-foreground">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Pick your Steam account and we&apos;ll find its AoE4World profile:
      </p>
      <div className="overflow-hidden rounded-lg border border-primary/25">
        {accounts.map((acc) => (
          <button
            key={acc.steamId}
            type="button"
            onClick={() => pick(acc)}
            disabled={resolvingId !== null}
            className="flex w-full items-center justify-between gap-2 border-b border-primary/15 px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary/80 disabled:opacity-60"
          >
            <span className="flex items-center gap-2 truncate">
              <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">
                {acc.personaName ?? acc.accountName ?? acc.steamId}
              </span>
              {acc.mostRecent && (
                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                  recent
                </span>
              )}
            </span>
            {resolvingId === acc.steamId ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => {
          setAccounts(null)
          setError(null)
        }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Back
      </button>
    </div>
  )
}
