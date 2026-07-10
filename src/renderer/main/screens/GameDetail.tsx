import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { StoredMatch } from '@store/historyStore'
import type { PerPlayerMatchStats, Severity, Signal } from '@domain/analysis'
import { resultFromPerPlayer, sanitizeStoredSignals, villagersPerMinute } from '@domain/analysis'
import { comparisonSignals } from '@domain/gameCoaching'
import { summarySignals } from '@domain/summaryCoaching'
import { buildIndexForCiv, condenseBuildOrder } from '@domain/buildOrderSchema'
import { parseDuration } from '@domain/format'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import { civDisplayName } from '@domain/civ'
import { CIV_FLAGS } from '@data/vendor/aoe4world-overlay/flags'
import { formatDurationShort, relativeTime } from '@shared/format'
import { cn } from '@shared/lib/utils'
import { Card, CardContent } from '@shared/components/ui/card'
import { Badge } from '@shared/components/ui/badge'
import { useDeleteMatch, useGameSummary, useHistory } from '../queries/useHistory'
import { useSettings } from '../queries/useProfile'
import { GameSummaryPanel } from '../components/GameSummaryPanel'
import { BuildTrainerCard } from '../components/BuildTrainerCard'
import { EmptyBox, ErrorBox, Spinner } from '../components/feedback'

const SEVERITY_STYLE: Record<Severity, string> = {
  major: 'bg-destructive/15 text-destructive',
  minor: 'bg-warn/15 text-warn',
  info: 'bg-secondary text-muted-foreground',
  good: 'bg-win/15 text-win',
}
const SEVERITY_ORDER: Record<Severity, number> = { major: 0, minor: 1, info: 2, good: 3 }

/**
 * The full post-game breakdown for one stored match (opened from a history card):
 * a per-player comparison of the real Relic counters (production, kills, deaths,
 * K/D, buildings, tech, APM — the numbers behind AoE4World's Comparison table) and
 * auto-generated coaching on what to improve. Economy (resources/villagers/score)
 * shows when the local stats are available; it's honestly labelled otherwise.
 */
export function GameDetail() {
  const { matchId } = useParams()
  const { data, isLoading, refetch } = useHistory()
  const { data: settings } = useSettings()

  return (
    <div className="animate-fade-in space-y-6">
      <Link
        to="/stats"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> My Stats
      </Link>

      {isLoading && <Spinner label="Loading game…" />}
      {!isLoading && data && !data.ok && (
        <ErrorBox message={data.error.message} onRetry={() => refetch()} />
      )}
      {!isLoading && data?.ok && (
        <Resolve matchId={matchId} matches={data.data} settings={settings} />
      )}
    </div>
  )
}

function Resolve({
  matchId,
  matches,
  settings,
}: {
  matchId: string | undefined
  matches: StoredMatch[]
  settings: { profileId: number | null; playerName: string | null } | undefined
}) {
  const match = matches.find((m) => m.id === matchId)
  if (!match) {
    return (
      <EmptyBox>
        <div className="space-y-1">
          <p>This game isn’t in your synced history.</p>
          <p className="text-xs">Head to My Stats and click “Sync recent games”.</p>
        </div>
      </EmptyBox>
    )
  }
  return (
    <Detail
      match={match}
      myProfileId={settings?.profileId ?? null}
      myName={settings?.playerName ?? null}
    />
  )
}

function Detail({
  match,
  myProfileId,
  myName,
}: {
  match: StoredMatch
  myProfileId: number | null
  myName: string | null
}) {
  const navigate = useNavigate()
  const deleteMatch = useDeleteMatch()
  const removeGame = () => {
    if (!window.confirm('Remove this game from your history? This cannot be undone.')) return
    deleteMatch.mutate(match.id, { onSuccess: () => navigate('/stats') })
  }
  const effectiveResult = match.result ?? resultFromPerPlayer(match.perPlayer, myProfileId)
  const win = effectiveResult === 'win'
  const loss = effectiveResult === 'loss'
  const resultWord = win ? 'Victory' : loss ? 'Defeat' : 'Result unknown'

  const nameByCiv = buildNameByCiv(match)
  const rows = orderRows(match.perPlayer ?? [], myProfileId)
  const { data: summaryRes, isLoading: summaryLoading } = useGameSummary(match.id)
  const summary = summaryRes?.ok ? summaryRes.data : null
  // Relic's "deaths" counter includes villagers; the stat file's lost list lets
  // us split them out so the number squares with the game's military tab.
  const villagersLostByProfile = new Map<number, number>(
    (summary?.players ?? [])
      .filter((p) => p.profileId != null && p.villagersLost != null)
      .map((p) => [p.profileId!, p.villagersLost!]),
  )

  // Feudal target from the civ's bundled build, for the age-up coaching read.
  const buildIdx = buildIndexForCiv(BUNDLED_BUILD_ORDERS, match.civ)
  const feudalTargetSec =
    buildIdx != null
      ? (condenseBuildOrder(BUNDLED_BUILD_ORDERS[buildIdx]!)
          .find((t) => t.ageUpTo === 2)
          ?.time?.trim() ?? null)
      : null

  const coaching = dedupeSignals([
    ...(summary
      ? summarySignals({
          summary,
          myProfileId,
          myCiv: match.civ,
          feudalTargetSec: feudalTargetSec ? parseDuration(feudalTargetSec) : null,
        })
      : []),
    ...comparisonSignals(match.perPlayer, myProfileId ?? -1),
    ...sanitizeStoredSignals(match.analysis.signals),
  ]).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const summaryText = effectiveSummary(match.analysis.summary, effectiveResult)

  const vpm = villagersPerMinute(match.local)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex h-9 items-center rounded-md px-3 text-sm font-bold uppercase tracking-wide',
              win
                ? 'bg-win/20 text-win'
                : loss
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-secondary text-muted-foreground',
            )}
          >
            {resultWord}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{matchTitle(match)}</h1>
          {match.custom && (
            <Badge variant="secondary" className="text-[10px]">
              {match.vsAI ? 'vs AI' : 'Custom'}
            </Badge>
          )}
          {match.ratingDiff != null && (
            <span
              className={cn(
                'tabular-nums text-sm font-semibold',
                match.ratingDiff >= 0 ? 'text-win' : 'text-destructive',
              )}
            >
              {match.ratingDiff >= 0 ? '+' : ''}
              {match.ratingDiff}
            </span>
          )}
          <button
            type="button"
            onClick={removeGame}
            disabled={deleteMatch.isPending}
            title="Remove this game from your history — for desynced matches the game itself never recorded"
            className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-loss/50 hover:text-loss disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {match.format ? `${match.format} · ` : ''}
          {match.map} · {formatDurationShort(match.durationSec)} · {relativeTime(match.playedAt)}
        </p>
      </header>

      {rows.length > 0 ? (
        <ComparisonTable
          rows={rows}
          myProfileId={myProfileId}
          nameByCiv={nameByCiv}
          myName={myName}
          villagersLostByProfile={villagersLostByProfile}
        />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No per-player breakdown for this game yet. Click{' '}
            <span className="font-medium text-foreground">Sync recent games</span> on My Stats to
            pull the production, combat and tech numbers from Relic.
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">What to improve</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{summaryText}</p>
            {coaching.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No standout issues this game — a clean, balanced performance.
              </p>
            )}
            {coaching.map((sig) => (
              <div key={sig.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                    SEVERITY_STYLE[sig.severity],
                  )}
                >
                  {sig.severity}
                </span>
                <div>
                  <div className="text-sm font-medium">{sig.title}</div>
                  <div className="text-xs text-muted-foreground">{sig.detail}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {summary && (
        <BuildTrainerCard summary={summary} myCiv={match.civ} myProfileId={myProfileId} />
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Economy &amp; build order</h2>
        {summary && summary.players.length > 0 ? (
          <GameSummaryPanel
            summary={summary}
            myCiv={match.civ}
            perPlayer={match.perPlayer}
            myProfileId={myProfileId}
          />
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {vpm != null && (
                <Metric
                  label="Villagers / min"
                  value={String(vpm)}
                  hint="your economy pace — the AoE4 CS/min"
                />
              )}
              <p className="text-muted-foreground">
                {summaryLoading
                  ? 'Reading the game’s stat file…'
                  : 'No stat file is available for this game yet. Summaries for multiplayer games are uploaded by the players themselves — for lobbies with AI no one may upload one, uploads can lag a few minutes behind the game, and desynced/abandoned matches never get one. Check back shortly; old games also age out of Relic’s window. Ranked/custom summaries need Steam connected in Settings.'}
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

const COLS: { key: keyof PerPlayerMatchStats; label: string; title: string }[] = [
  {
    key: 'unitsProduced',
    label: 'Units',
    title:
      "Units produced across the whole game — NOT the game's 'Largest Army' (peak size at once); that's in Military and production below",
  },
  { key: 'kills', label: 'Kills', title: 'Enemy units killed' },
  { key: 'deaths', label: 'Deaths', title: 'Your units lost' },
  { key: 'kd', label: 'K/D', title: 'Kills ÷ deaths' },
  { key: 'buildingsProduced', label: 'Buildings', title: 'Buildings constructed' },
  { key: 'techsResearched', label: 'Techs', title: 'Upgrades / technologies researched' },
  { key: 'apm', label: 'APM', title: 'Actions per minute' },
]

function ComparisonTable({
  rows,
  myProfileId,
  nameByCiv,
  myName,
  villagersLostByProfile,
}: {
  rows: PerPlayerMatchStats[]
  myProfileId: number | null
  nameByCiv: Map<string, string>
  myName: string | null
  villagersLostByProfile?: Map<number, number>
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Comparison</h2>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="rts-ledger-head px-3 py-2 text-left">Player</th>
                {COLS.map((c) => (
                  <th key={c.key} title={c.title} className="rts-ledger-head px-3 py-2 text-right">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isMe = r.profileId === myProfileId
                const name = isMe ? (myName ?? 'You') : r.civ ? nameByCiv.get(r.civ) : undefined
                return (
                  <tr
                    key={r.profileId}
                    className={cn(
                      'border-b border-border/60 last:border-b-0',
                      isMe && 'bg-primary/5',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Flag civ={r.civ} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{name ?? civLabel(r.civ)}</span>
                            {isMe && (
                              <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold uppercase text-primary">
                                You
                              </span>
                            )}
                            {r.result === 'win' && (
                              <span className="text-[10px] font-semibold text-win">W</span>
                            )}
                            {r.result === 'loss' && (
                              <span className="text-[10px] font-semibold text-destructive">L</span>
                            )}
                          </div>
                          {name && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {civLabel(r.civ)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {COLS.map((c) => {
                      const vills =
                        c.key === 'deaths' ? villagersLostByProfile?.get(r.profileId) : undefined
                      return (
                        <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                          {fmt(r[c.key])}
                          {vills != null && vills > 0 && (
                            <span
                              className="ml-1 text-[10px] text-muted-foreground"
                              title="Villagers included in the deaths count — the game's military tab counts only troops"
                            >
                              ({vills} vills)
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Production, combat, tech and APM from Relic (the same source AoE4World reads). Deaths
        include villagers — the game's military tab counts troops only. Economy isn't in this feed,
        so it isn't shown as a column.
      </p>
    </section>
  )
}

function Flag({ civ }: { civ: string | null }) {
  const entry = civ ? CIV_FLAGS[civ] : undefined
  if (!entry) {
    return (
      <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-[8px] font-bold uppercase text-muted-foreground">
        {civ ? civDisplayName(civ).slice(0, 3) : '—'}
      </span>
    )
  }
  return (
    <img
      src={entry.flag}
      alt={civ ? civDisplayName(civ) : 'civ'}
      style={{ outlineColor: entry.color }}
      className="h-5 w-9 shrink-0 rounded-sm object-cover outline outline-1"
    />
  )
}

function fmt(v: number | string | null | undefined): string {
  if (v == null) return '—'
  return String(v)
}

/** civDisplayName that tolerates a null slug (unknown civ). */
function civLabel(civ: string | null): string {
  return civ ? civDisplayName(civ) : 'Unknown'
}

/** A "Civ vs Civ" (or team) title for the game header. */
function matchTitle(match: StoredMatch): string {
  const mine = civDisplayName(match.civ)
  const opp =
    match.oppTeam && match.oppTeam.length > 0
      ? match.oppTeam.map((p) => civDisplayName(p.civ)).join(' + ')
      : match.oppCiv
        ? civDisplayName(match.oppCiv)
        : 'Unknown'
  const myTeam =
    match.myTeam && match.myTeam.length > 0
      ? [mine, ...match.myTeam.map((p) => civDisplayName(p.civ))].join(' + ')
      : mine
  return `${myTeam} vs ${opp}`
}

/** Rows grouped as (my team, me first) then the enemy team. */
function orderRows(
  perPlayer: PerPlayerMatchStats[],
  myProfileId: number | null,
): PerPlayerMatchStats[] {
  const me = perPlayer.find((p) => p.profileId === myProfileId)
  const myTeamId = me?.teamId ?? null
  return [...perPlayer].sort((a, b) => {
    const aSide = a.teamId === myTeamId ? 0 : 1
    const bSide = b.teamId === myTeamId ? 0 : 1
    if (aSide !== bSide) return aSide - bSide
    const aMe = a.profileId === myProfileId ? 0 : 1
    const bMe = b.profileId === myProfileId ? 0 : 1
    return aMe - bMe
  })
}

/**
 * A civ→name map from the stored roster, so the comparison table can label the
 * enemy/ally rows (the counters feed has profile ids, the roster has names). Only
 * unambiguous civs are kept — a civ that two players share resolves to no name
 * rather than the wrong one.
 */
function buildNameByCiv(match: StoredMatch): Map<string, string> {
  const seen = new Map<string, string | null>()
  const add = (civ: string | null, name: string | null) => {
    if (!civ || !name) return
    seen.set(civ, seen.has(civ) ? null : name) // second sighting → ambiguous
  }
  for (const p of match.myTeam ?? []) add(p.civ, p.name)
  for (const p of match.oppTeam ?? []) add(p.civ, p.name)
  if ((match.oppTeam?.length ?? 0) === 0) add(match.oppCiv, match.oppName)
  const out = new Map<string, string>()
  for (const [civ, name] of seen) if (name) out.set(civ, name)
  return out
}

function dedupeSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>()
  return signals.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
}

function effectiveSummary(summary: string, result: 'win' | 'loss' | null): string {
  if (result === 'win') return summary.replace(/^Game as /, 'Win as ')
  if (result === 'loss') return summary.replace(/^Game as /, 'Loss as ')
  return summary
}
