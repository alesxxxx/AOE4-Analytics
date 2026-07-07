import { useCallback, useEffect, useState } from 'react'
import { User, Monitor, Gauge, Keyboard, Gamepad2, Loader2, Check, Palette, Pipette } from 'lucide-react'
import type { Leaderboard } from '@api/types'
import {
  DEFAULT_HOTKEYS,
  DEFAULT_OVERLAY_WIDGET_POSITIONS,
  type AppSettings,
  type OverlayWidgetAnchor,
} from '@store/settings'
import { matchSteamAccount, type SteamAccount } from '@domain/steamAccounts'
import { ipc } from '@shared/ipc'
import { cn } from '@shared/lib/utils'
import { useDebounce } from '@shared/hooks/useDebounce'
import { ACCENT_PRESETS, currentAccentHex } from '@shared/accent'
import { Card, CardContent } from '@shared/components/ui/card'
import { useSettings, useUpdateSettings, useRemoveAccount } from '../queries/useProfile'
import { PageHead } from '../components/PageHead'
import { SteamConnectCard } from '../components/SteamConnectCard'

const LEADERBOARDS: { value: Leaderboard; label: string }[] = [
  { value: 'rm_solo', label: 'Ranked 1v1 (Solo)' },
  { value: 'qm_1v1', label: 'Quick Match 1v1' },
  { value: 'rm_team', label: 'Ranked Team' },
]
const POLL_OPTIONS = [
  { value: 10_000, label: '10s' },
  { value: 15_000, label: '15s (recommended)' },
  { value: 30_000, label: '30s' },
]
export function Settings() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const removeAccount = useRemoveAccount()

  const toggleHotkey = settings?.hotkeys.toggleOverlay ?? DEFAULT_HOTKEYS.toggleOverlay
  const placementHotkey = settings?.hotkeys.placementMode ?? DEFAULT_HOTKEYS.placementMode

  // The sliders track a local value and commit it debounced — one settings
  // write + overlay IPC after the drag settles instead of one per tick.
  const [liveOpacity, setLiveOpacity] = useState<number | null>(null)
  const debouncedOpacity = useDebounce(liveOpacity, 200)
  const { mutate: commitSettings } = update
  useEffect(() => {
    if (debouncedOpacity == null) return
    commitSettings(
      { overlay: { opacity: debouncedOpacity } },
      { onSuccess: () => void ipc.applyOverlaySettings() },
    )
  }, [debouncedOpacity, commitSettings])
  const opacity = liveOpacity ?? settings?.overlay.opacity ?? 0.92

  const [liveScale, setLiveScale] = useState<number | null>(null)
  const debouncedScale = useDebounce(liveScale, 200)
  useEffect(() => {
    if (debouncedScale == null) return
    commitSettings(
      { overlay: { scale: debouncedScale } },
      { onSuccess: () => void ipc.applyOverlaySettings() },
    )
  }, [debouncedScale, commitSettings])
  const scale = liveScale ?? settings?.overlay.scale ?? 1

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead kicker="Preferences" title="Settings" sub="Profile, appearance, overlay, and data." />

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </h2>
          <AccentPicker
            value={settings?.accentColor ?? null}
            onChange={(accentColor) =>
              update.mutate({ accentColor }, { onSuccess: () => void ipc.applyOverlaySettings() })
            }
          />
          <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span>
              Civilization themes
              <span className="block text-[11px] text-muted-foreground">
                While a match is live, the app and overlay re-accent to the colours of the civ
                you&apos;re playing, then revert when the game ends.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.civTheme ?? true}
              onChange={(e) =>
                update.mutate(
                  { civTheme: e.target.checked },
                  { onSuccess: () => void ipc.applyOverlaySettings() },
                )
              }
              className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <User className="h-4 w-4 text-primary" />
            Profile
          </h2>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{settings?.playerName ?? '—'}</div>
              <div className="text-xs text-muted-foreground">
                AoE4World ID {settings?.profileId ?? '—'} · ladder {settings?.leaderboard}
              </div>
            </div>
            <button
              type="button"
              disabled={settings?.profileId == null}
              onClick={() => {
                if (settings?.profileId == null) return
                if (!window.confirm('Remove this account from RTSLytics? This cannot be undone.'))
                  return
                removeAccount.mutate(settings.profileId)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              Remove account
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Switch between or add accounts from the picker in the top command bar.
          </p>
        </CardContent>
      </Card>

      <SteamIdentityCard settings={settings} onPin={(steamId) => update.mutate({ steamId })} />

      <SteamConnectCard />

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Monitor className="h-4 w-4 text-primary" />
            Overlay
          </h2>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>Opacity</span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setLiveOpacity(Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>Widget size</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={scale}
              onChange={(e) => setLiveScale(Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            The overlay shows the matchup across the top, a live APM counter, and a results card
            after each game. Press {toggleHotkey} to show or hide it, and {placementHotkey} to
            move widgets.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void ipc.toggleOverlay()}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Show / hide overlay ({toggleHotkey})
            </button>
            <button
              type="button"
              disabled={!settings}
              onClick={() => {
                if (!settings) return
                update.mutate(
                  {
                    overlay: {
                      ...settings.overlay,
                      widgetPositions: DEFAULT_OVERLAY_WIDGET_POSITIONS,
                    },
                  },
                  { onSuccess: () => void ipc.applyOverlaySettings() },
                )
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              Reset widget positions
            </button>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Only show overlay while AoE4 is focused
                <span className="block text-[11px] text-muted-foreground">
                  Turn OFF if the overlay shows on your desktop but not over the game — it&apos;ll
                  then show whenever a match is live, regardless of window focus.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings?.overlay.gateToGame ?? true}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    { overlay: { ...settings.overlay, gateToGame: e.target.checked } },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Live APM counter
                <span className="block text-[11px] text-muted-foreground">
                  Counts your key/mouse actions while in a match (counts only, never which keys).
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings?.overlay.apm ?? true}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    { overlay: { ...settings.overlay, apm: e.target.checked } },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">APM corner</span>
              <select
                value={settings?.overlay.apmCorner ?? 'bottom-left'}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    {
                      overlay: {
                        ...settings.overlay,
                        apmCorner: e.target.value as typeof settings.overlay.apmCorner,
                        widgetPositions: {
                          ...settings.overlay.widgetPositions,
                          apm: {
                            anchor: e.target.value as OverlayWidgetAnchor,
                            x: 12,
                            y: 12,
                          },
                        },
                      },
                    },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="top-left">Top-left</option>
                <option value="top-right">Top-right</option>
                <option value="bottom-left">Bottom-left</option>
                <option value="bottom-right">Bottom-right</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Matchup troops panel
                <span className="block text-[11px] text-muted-foreground">
                  Under the matchup bar: your build order (counters flagged) vs their key units.
                </span>
              </span>
              <select
                value={settings?.overlay.troopsPos ?? 'bar'}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    {
                      overlay: {
                        ...settings.overlay,
                        troopsPos: e.target.value as typeof settings.overlay.troopsPos,
                      },
                    },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="bar">Under the matchup bar</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Age-up pace targets
                <span className="block text-[11px] text-muted-foreground">
                  A small chip with target Feudal/Castle/Imperial times for your rank next to the
                  live match clock. Pace targets, never a live reading.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings?.overlay.showAgeTargets ?? true}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    { overlay: { ...settings.overlay, showAgeTargets: e.target.checked } },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                Session tracker
                <span className="block text-[11px] text-muted-foreground">
                  Today&apos;s record at a glance — &quot;3W – 1L +42&quot; — so a losing streak is
                  visible without leaving the game.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings?.overlay.showSession ?? true}
                onChange={(e) => {
                  if (!settings) return
                  update.mutate(
                    { overlay: { ...settings.overlay, showSession: e.target.checked } },
                    { onSuccess: () => void ipc.applyOverlaySettings() },
                  )
                }}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
            </label>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>
                Build order on overlay
                <span className="block text-[11px] text-muted-foreground">
                  {settings?.overlay.buildOrderId
                    ? `Showing "${settings.overlay.buildOrderId}" step-by-step during matches.`
                    : 'None selected — pick one in Guides → Build Orders → "Show in overlay".'}
                </span>
              </span>
              {settings?.overlay.buildOrderId && (
                <button
                  type="button"
                  onClick={() => {
                    if (!settings) return
                    update.mutate(
                      { overlay: { ...settings.overlay, buildOrderId: null } },
                      { onSuccess: () => void ipc.applyOverlaySettings() },
                    )
                  }}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Remove
                </button>
              )}
            </div>
            <HotkeyInput
              label="Show / hide overlay hotkey"
              value={toggleHotkey}
              defaultValue={DEFAULT_HOTKEYS.toggleOverlay}
              onCommit={(accelerator) => update.mutate({ hotkeys: { toggleOverlay: accelerator } })}
            />
            <HotkeyInput
              label="Move overlay widgets hotkey"
              value={placementHotkey}
              defaultValue={DEFAULT_HOTKEYS.placementMode}
              onCommit={(accelerator) => update.mutate({ hotkeys: { placementMode: accelerator } })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-4 w-4 text-primary" />
              Match polling
            </h2>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Check for a new game every</span>
              <select
                value={settings?.polling.idleIntervalMs ?? 15_000}
                onChange={(e) => {
                  if (!settings) return
                  const v = Number(e.target.value)
                  update.mutate({
                    polling: { ...settings.polling, idleIntervalMs: v, activeIntervalMs: v },
                  })
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {POLL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              15s is the community-polite rate. RTSLytics caches aggressively and never
              bulk-scrapes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-base font-semibold">Default ladder</h2>
            <select
              value={settings?.leaderboard ?? 'rm_solo'}
              onChange={(e) => update.mutate({ leaderboard: e.target.value as Leaderboard })}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LEADERBOARDS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Used for your dashboard form, scouting, and post-game analysis.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-base font-semibold">Stats</h2>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              Exclude AI / custom games from win rate
              <span className="block text-[11px] text-muted-foreground">
                Keep practice games vs AI out of your win-rate, stats, and history view so they don&apos;t
                muddy your real (ranked) record. You still get a post-game card after each one.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.localData.excludeAiFromStats ?? false}
              onChange={(e) => {
                if (!settings) return
                update.mutate({
                  localData: { ...settings.localData, excludeAiFromStats: e.target.checked },
                })
              }}
              className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              Open the game summary after each match
              <span className="block text-[11px] text-muted-foreground">
                When a match ends (win or loss), bring RTSLytics to the front on that game&apos;s
                full post-game breakdown.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings?.openSummaryOnGameEnd ?? true}
              onChange={(e) => update.mutate({ openSummaryOnGameEnd: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Keyboard className="h-4 w-4 text-primary" />
            Hotkeys
          </h2>
          <div className="divide-y divide-border text-sm">
            {[
              [toggleHotkey, 'Show / hide overlay'],
              [placementHotkey, 'Move overlay widgets'],
            ].map(([key, desc]) => (
              <div key={desc} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">{desc}</span>
                <kbd className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">{key}</kbd>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Change the bindings from the Overlay section above.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * A global hotkey binding row: a text input in Electron accelerator format
 * (e.g. "Alt+O", "Ctrl+Shift+F1"), committed on blur/Enter. The main process
 * validates it (at least one modifier required) and re-registers immediately;
 * an invalid or rejected value simply snaps back to the current binding.
 */
function HotkeyInput({
  label,
  value,
  defaultValue,
  onCommit,
}: {
  label: string
  value: string
  defaultValue: string
  onCommit: (accelerator: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    // Snap back to the committed binding; the settings refresh brings the new one.
    setDraft(value)
  }
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        {label}
        <span className="block text-[11px] text-muted-foreground">
          Electron accelerator format with at least one modifier, e.g. {defaultValue}.
        </span>
      </span>
      <input
        type="text"
        value={draft}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-8 w-36 shrink-0 rounded-md border border-border bg-background px-2 text-center font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

/**
 * Pick the app's accent (action) colour — curated swatches plus a full custom
 * colour input. Applies live to both windows. Reset falls back to the default blue.
 */
function AccentPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (hex: string | null) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm">
        Accent color
        <span className="block text-[11px] text-muted-foreground">
          The action colour for buttons, links, active tabs, focus rings, and the in-game
          overlay. Applies everywhere instantly.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ACCENT_PRESETS.map((p) => {
          const active = value?.toLowerCase() === p.hex.toLowerCase()
          return (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              onClick={() => onChange(p.hex)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                active ? 'border-foreground' : 'border-black/40',
              )}
              style={{ backgroundColor: p.hex }}
            />
          )
        })}
        <label
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Custom color"
        >
          <Pipette className="h-3.5 w-3.5" />
          Custom
          <input
            type="color"
            value={value ?? currentAccentHex()}
            onChange={(e) => onChange(e.target.value)}
            className="h-0 w-0 opacity-0"
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Links the active AoE4 profile to a local Steam account so the overlay knows which
 * player is YOU (vital in 2-human custom lobbies). Auto-suggests the account that
 * matches the profile — by SteamID64 first, then by name — and lets you pin it.
 * Pinned wins over auto-detection in the live matchup.
 */
function SteamIdentityCard({
  settings,
  onPin,
}: {
  settings: AppSettings | undefined
  onPin: (steamId: string | null) => void
}) {
  const [accounts, setAccounts] = useState<SteamAccount[] | null>(null)
  const [profileSteamId, setProfileSteamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)

  const detect = useCallback(async () => {
    setLoading(true)
    setDetectError(null)
    try {
      const [accs, dash] = await Promise.all([ipc.detectSteamAccounts(), ipc.getDashboard()])
      setAccounts(accs)
      setProfileSteamId(dash.ok ? dash.data.steamId : null)
    } catch {
      setDetectError('Could not detect Steam accounts. Click Re-detect to try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void detect()
  }, [detect])

  const pinned = settings?.steamId ?? null
  const suggested = accounts
    ? matchSteamAccount(accounts, { steamId: profileSteamId, name: settings?.playerName })
    : null

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Gamepad2 className="h-4 w-4 text-primary" />
          Steam account
        </h2>
        <p className="text-xs text-muted-foreground">
          Identifies which player is <span className="font-medium text-foreground">you</span> in
          custom / AI games, so the overlay shows the right side. We match your AoE4 profile to a
          Steam account by Steam ID, then by name. Leave it on auto if you have one account.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Detecting Steam accounts…
          </div>
        )}

        {!loading && detectError && <p className="text-sm text-destructive">{detectError}</p>}

        {!loading && accounts && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No Steam accounts found on this PC. (If you play on Xbox, the overlay still picks you as
            the only human in vs-AI games.)
          </p>
        )}

        {!loading && accounts && accounts.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            {accounts.map((acc) => {
              const isPinned = pinned === acc.steamId
              const isSuggested = suggested?.steamId === acc.steamId
              return (
                <button
                  key={acc.steamId}
                  type="button"
                  onClick={() => onPin(acc.steamId)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-secondary"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {acc.personaName ?? acc.accountName ?? acc.steamId}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {acc.steamId}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isSuggested && !isPinned && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                        matches profile
                      </span>
                    )}
                    {acc.mostRecent && !isSuggested && !isPinned && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        recent
                      </span>
                    )}
                    {isPinned ? (
                      <span className="flex items-center gap-1 rounded bg-win/15 px-1.5 py-0.5 text-[10px] text-win">
                        <Check className="h-3 w-3" /> you
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">pin</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => void detect()}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Re-detect
          </button>
          {pinned && (
            <button
              type="button"
              onClick={() => onPin(null)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Use auto (unpin)
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
