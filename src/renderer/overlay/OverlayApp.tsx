import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Move } from 'lucide-react'
import { ipc } from '@shared/ipc'
import type { ScoutReport } from '@domain/types'
import type { LiveMatchup } from '@domain/liveMatch'
import type { SessionSummary } from '@domain/session'
import type { OverlayMatchState, PostGameSummary } from '@ipc/contract'
import { matchupTroopsForTeam } from '@domain/civUnits'
import { gameElapsedSec, todMsFromEpoch } from '@domain/localStats'
import { bracketFromRankLevel, getBenchmarks } from '@domain/benchmarks'
import { stepIndexForElapsed, type BuildOrder } from '@domain/buildOrderSchema'
import { applyAccent } from '@shared/accent'
import { CIV_FLAGS } from '@data/vendor/aoe4world-overlay/flags'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import {
  DEFAULT_OVERLAY_WIDGET_POSITIONS,
  type OverlayWidgetAnchor,
  type OverlayWidgetKey,
  type OverlayWidgetPosition,
  type OverlayWidgetPositions,
} from '@store/settings'
import { MatchupBar, type MatchupSide } from './MatchupBar'
import { PostGameCard } from './PostGameCard'
import { ApmWidget } from './ApmWidget'
import { BuildOrderWidget } from './BuildOrderWidget'
import { AgeTargetsWidget } from './AgeTargetsWidget'
import { SessionWidget } from './SessionWidget'
import { panelBg } from './panelBg'

const PLACEHOLDER_MATCHUP: LiveMatchup = {
  teams: [
    [
      {
        profileId: 1,
        name: 'You',
        civ: 'english',
        rating: 950,
        rank: null,
        rankLevel: 'gold_2',
        isMe: true,
        isAI: false,
      },
      {
        profileId: 2,
        name: 'Ally',
        civ: 'abbasid_dynasty',
        rating: 920,
        rank: null,
        rankLevel: 'gold_1',
        isMe: false,
        isAI: false,
      },
    ],
    [
      {
        profileId: 3,
        name: 'Enemy 1',
        civ: 'french',
        rating: 980,
        rank: null,
        rankLevel: 'gold_3',
        isMe: false,
        isAI: false,
      },
      {
        profileId: 4,
        name: 'Enemy 2',
        civ: 'mongols',
        rating: 940,
        rank: null,
        rankLevel: 'gold_2',
        isMe: false,
        isAI: false,
      },
    ],
  ],
}

const PLACEHOLDER_SESSION: SessionSummary = { games: 4, wins: 3, losses: 1, ratingDelta: 42 }

const PLACEHOLDER_POST_GAME: PostGameSummary = {
  result: 'win',
  civ: 'english',
  oppCiv: 'french',
  map: 'Dry Arabia',
  grade: 'B+',
  apm: 72,
  durationSec: 1320,
  didWell: ['Kept villager production steady'],
  improve: ['Spend resources before the next fight'],
  vsAI: false,
}

const WIDGET_LABELS: Record<OverlayWidgetKey, string> = {
  matchup: 'Matchup and troops',
  apm: 'Live APM',
  postGame: 'Post-game card',
  buildOrder: 'Build order',
  ageTargets: 'Age targets',
  session: 'Session record',
}

/**
 * Transparent in-game overlay root. The placement hotkey (Ctrl+Alt+O by
 * default) toggles placement mode: the same current widgets become draggable,
 * and idle mode renders placeholders so the player can arrange the overlay
 * before queueing.
 */
export function OverlayApp() {
  const [matchState, setMatchState] = useState<OverlayMatchState>('idle')
  const [myCiv, setMyCiv] = useState<string | null>(null)
  const [oppCiv, setOppCiv] = useState<string | null>(null)
  const [oppName, setOppName] = useState<string | null>(null)
  const [oppIsAI, setOppIsAI] = useState(false)
  const [matchup, setMatchup] = useState<LiveMatchup | null>(null)
  const [oppScout, setOppScout] = useState<ScoutReport | null>(null)
  const [postGame, setPostGame] = useState<PostGameSummary | null>(null)
  const [apm, setApm] = useState<number | null>(null)
  const [session, setSession] = useState<SessionSummary | null>(null)
  const [sessionShown, setSessionShown] = useState(true)
  const [troopsShown, setTroopsShown] = useState(true)
  const [civTheme, setCivTheme] = useState(true)
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const [placementMode, setPlacementMode] = useState(false)
  // The user's overlay opacity, applied as PANEL BACKGROUND alpha only (via the
  // --panel-alpha CSS variable) — the window stays at setOpacity(1) so text and
  // icons never dim with it.
  const [panelAlpha, setPanelAlpha] = useState(1)
  // Per-widget scale, applied as a CSS transform around each widget's anchor
  // corner so saved positions stay put across scale changes.
  const [scale, setScale] = useState(1)
  const [ageTargetsShown, setAgeTargetsShown] = useState(true)
  // The pinned build order's unique name (Guides → "Show in overlay"); null = hidden.
  const [buildOrderId, setBuildOrderId] = useState<string | null>(null)
  // Live match time in seconds, derived from the pushed game-clock anchor
  // (warnings.log sim start + pauses) + our wall clock; null when not in a match.
  const [elapsedSec, setElapsedSec] = useState<number | null>(null)
  const [widgetPositions, setWidgetPositions] = useState<OverlayWidgetPositions>(
    DEFAULT_OVERLAY_WIDGET_POSITIONS,
  )

  useEffect(() => {
    ipc
      .getSettings()
      .then((s) => {
        setTroopsShown(s.overlay.troopsPos !== 'hidden')
        setCivTheme(s.civTheme !== false)
        setWidgetPositions(clampPositions(s.overlay.widgetPositions))
        setPlacementMode(!s.overlay.locked)
        setAccentColor(s.accentColor ?? null)
        setPanelAlpha(clampAlpha(s.overlay.opacity))
        setScale(clampScale(s.overlay.scale))
        setAgeTargetsShown(s.overlay.showAgeTargets !== false)
        setSessionShown(s.overlay.showSession !== false)
        setBuildOrderId(s.overlay.buildOrderId ?? null)
      })
      .catch(() => {})

    // The overlay window is resized to the display's work area on monitor /
    // resolution changes — re-clamp so a widget saved on a larger display
    // can't sit off-canvas. Clamped in-memory only: the saved position is
    // untouched, so plugging the big monitor back in restores it.
    const onResize = () => setWidgetPositions((p) => clampPositions(p))
    window.addEventListener('resize', onResize)

    const offLock = ipc.onOverlayLock((locked) => setPlacementMode(!locked))
    const offApm = ipc.onOverlayApm((v) => setApm(v))
    // The main process re-pushes the clock ANCHOR every second while a match is
    // live; elapsed is derived here from the anchor + our wall clock (freezes
    // through pauses because the anchor carries them).
    const offClock = ipc.onOverlayGameClock((clock) =>
      setElapsedSec(clock ? gameElapsedSec(clock, todMsFromEpoch(Date.now())) : null),
    )
    const offSettings = ipc.onOverlaySettings((o) => {
      setTroopsShown(o.troopsPos !== 'hidden')
      setCivTheme(o.civTheme !== false)
      setWidgetPositions(clampPositions(o.widgetPositions))
      setAccentColor(o.accentColor ?? null)
      setPanelAlpha(clampAlpha(o.opacity))
      setScale(clampScale(o.scale))
      setAgeTargetsShown(o.showAgeTargets !== false)
      setSessionShown(o.showSession !== false)
      setBuildOrderId(o.buildOrderId ?? null)
    })

    const offUpdate = ipc.onOverlayUpdate((p) => {
      setMatchState(p.matchState)
      setSession(p.session ?? null)
      if (p.matchState === 'ongoing') {
        setMyCiv(p.myCiv)
        setOppCiv(p.oppCiv)
        setOppName(p.oppName)
        setOppIsAI(p.oppIsAI)
        setOppScout(p.scout)
        setMatchup(p.matchup)
        setPostGame(null)
      } else {
        setMyCiv(null)
        setOppCiv(null)
        setOppName(null)
        setOppIsAI(false)
        setOppScout(null)
        setMatchup(null)
        setPostGame(p.postGame ?? null)
      }
    })
    return () => {
      offUpdate()
      offApm()
      offClock()
      offSettings()
      offLock()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const inGame = matchState === 'ongoing'

  // Civilization theme: while a match is live re-accent to your civ's colour;
  // otherwise the user's accent (or default gold).
  useEffect(() => {
    const civHex = civTheme && inGame && myCiv ? (CIV_FLAGS[myCiv]?.color ?? null) : null
    applyAccent(civHex ?? accentColor)
  }, [civTheme, inGame, myCiv, accentColor])
  const renderMatchup = matchup ?? (!inGame && placementMode ? PLACEHOLDER_MATCHUP : null)
  const haveMatchup =
    inGame && ((matchup?.teams.length ?? 0) >= 2 || myCiv != null || oppCiv != null)
  const showMatchup = haveMatchup || placementMode
  const showPostGame = (matchState === 'ended' && postGame != null) || placementMode
  const showApm = apm != null || placementMode
  // Shown whenever the overlay is up with a session to report (in-game AND on
  // the post-game screen, where the just-finished game is already counted).
  const showSession = sessionShown && (session != null || placementMode)

  // The pinned build order, resolved by its unique bundled name; null = hidden.
  const selectedBuild = useMemo<BuildOrder | null>(
    () =>
      buildOrderId
        ? ((BUNDLED_BUILD_ORDERS as unknown as BuildOrder[]).find((b) => b.name === buildOrderId) ??
          null)
        : null,
    [buildOrderId],
  )
  const showBuildOrder = selectedBuild != null && (inGame || placementMode)
  const showAgeTargets = ageTargetsShown && (inGame || placementMode)
  // Placement mode outside a match previews with a fake clock (like the other placeholders).
  const renderElapsed = elapsedSec ?? (placementMode && !inGame ? 312 : null)
  // The overlay renderer loads at app boot while its window is hidden, so it
  // must not scout the current profile just to prime this view. PollManager
  // sends the enriched team matchup when a live game starts; until then the
  // legacy fallback intentionally shows the civ-only pending state.
  const matchupMe = renderMatchup?.teams.flat().find((p) => p.isMe) ?? null
  const bracket = bracketFromRankLevel(matchupMe?.rankLevel)

  const troopMyCiv =
    renderMatchup?.teams[0]?.find((p) => p.isMe)?.civ ?? renderMatchup?.teams[0]?.[0]?.civ ?? myCiv
  const enemyCivs = renderMatchup
    ? renderMatchup.teams
        .slice(1)
        .flat()
        .map((p) => p.civ)
    : [oppCiv]
  const troops =
    (inGame || placementMode) && troopsShown ? matchupTroopsForTeam(troopMyCiv, enemyCivs) : null

  const me: MatchupSide = {
    civ: matchupMe?.civ ?? myCiv,
    name: matchupMe?.name ?? null,
    rankLevel: matchupMe?.rankLevel ?? null,
    rating: matchupMe?.rating ?? null,
    winRate: null,
    favoriteCivs: [],
    isAI: matchupMe?.isAI ?? false,
  }
  const opponent: MatchupSide = oppScout
    ? sideFromScout(oppScout, oppCiv, false)
    : {
        civ: oppCiv,
        name: oppName,
        rankLevel: null,
        rating: null,
        winRate: null,
        favoriteCivs: [],
        isAI: oppIsAI,
      }

  // ✕ on the post-game card: clear it locally right away (no flicker waiting
  // for the round-trip), then let the main process reset match state + hide.
  const dismissPostGame = () => {
    setPostGame(null)
    setMatchState('idle')
    void ipc.dismissOverlayPostGame().catch(() => {})
  }

  const saveWidgetPosition = (key: OverlayWidgetKey, position: OverlayWidgetPosition) => {
    setWidgetPositions((prev) => {
      const next = { ...prev, [key]: position }
      void ipc.updateSettings({ overlay: { widgetPositions: next } }).catch(() => {})
      return next
    })
  }

  return (
    <div
      className="relative h-screen w-screen select-none text-white"
      style={{ '--panel-alpha': panelAlpha } as CSSProperties}
    >
      {showMatchup && (
        <PlacedWidget
          widgetKey="matchup"
          position={widgetPositions.matchup}
          placementMode={placementMode}
          zIndex={50}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          <MatchupBar
            me={me}
            opponent={opponent}
            matchup={renderMatchup}
            troops={troopsShown ? troops : null}
          />
        </PlacedWidget>
      )}

      {showPostGame && (
        <PlacedWidget
          widgetKey="postGame"
          position={widgetPositions.postGame}
          placementMode={placementMode}
          zIndex={60}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          {/* No ✕ in placement mode: the card is a drag handle there (and may be a placeholder). */}
          <PostGameCard
            summary={postGame ?? PLACEHOLDER_POST_GAME}
            onDismiss={postGame && !placementMode ? dismissPostGame : undefined}
          />
        </PlacedWidget>
      )}

      {showApm && (
        <PlacedWidget
          widgetKey="apm"
          position={widgetPositions.apm}
          placementMode={placementMode}
          zIndex={55}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          <ApmWidget apm={apm ?? 72} />
        </PlacedWidget>
      )}

      {showSession && (
        <PlacedWidget
          widgetKey="session"
          position={widgetPositions.session}
          placementMode={placementMode}
          zIndex={55}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          <SessionWidget session={session ?? PLACEHOLDER_SESSION} />
        </PlacedWidget>
      )}

      {showBuildOrder && selectedBuild && (
        <PlacedWidget
          widgetKey="buildOrder"
          position={widgetPositions.buildOrder}
          placementMode={placementMode}
          zIndex={40}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          <div
            className="pointer-events-none w-[340px] select-none rounded-lg py-1 shadow-xl ring-1 ring-white/10"
            style={{
              background: `linear-gradient(to bottom right, ${panelBg(0.95)}, ${panelBg(0.7)})`,
              textShadow: '0 1px 3px rgba(0,0,0,0.95)',
            }}
          >
            <BuildOrderWidget
              bo={selectedBuild}
              stepIndex={
                renderElapsed != null
                  ? stepIndexForElapsed(selectedBuild.build_order, renderElapsed)
                  : 0
              }
              elapsedSec={renderElapsed}
              auto={renderElapsed != null}
              opponentCivs={enemyCivs}
            />
          </div>
        </PlacedWidget>
      )}

      {showAgeTargets && (
        <PlacedWidget
          widgetKey="ageTargets"
          position={widgetPositions.ageTargets}
          placementMode={placementMode}
          zIndex={45}
          scale={scale}
          onPositionChange={saveWidgetPosition}
        >
          <div
            className="pointer-events-none w-48 select-none rounded-lg text-white shadow-xl ring-1 ring-white/10"
            style={{
              background: `linear-gradient(to bottom right, ${panelBg(0.95)}, ${panelBg(0.7)})`,
              textShadow: '0 1px 3px rgba(0,0,0,0.95)',
            }}
          >
            <AgeTargetsWidget
              benchmarks={getBenchmarks(bracket)}
              bracket={bracket}
              elapsedSec={renderElapsed}
            />
          </div>
        </PlacedWidget>
      )}

      {placementMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center">
          <span className="rounded-full bg-[#0b0e14]/95 px-4 py-2 text-xs font-medium text-white/85 shadow-2xl ring-1 ring-primary/60">
            Drag any outlined widget to place it · use the same shortcut when done
          </span>
        </div>
      )}

      {!placementMode && !showMatchup && !showPostGame && (
        <div className="pointer-events-none fixed inset-x-0 top-1.5 z-50 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-md bg-[#0b0e14]/85 px-2.5 py-1 text-[11px] text-white/70 shadow-lg ring-1 ring-white/10">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
            RTSLytics
            <span className="text-white/40">
              {inGame
                ? 'finding matchup...'
                : matchState === 'ended'
                  ? 'analyzing your game...'
                  : 'waiting for a game'}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

function sideFromScout(scout: ScoutReport | null, civ: string | null, isAI: boolean): MatchupSide {
  return {
    civ,
    name: scout?.name ?? null,
    rankLevel: scout?.primary?.rankLevel ?? null,
    rating: scout?.primary?.rating ?? null,
    winRate: scout?.recentForm?.winRate ?? scout?.primary?.winRate ?? null,
    favoriteCivs: (scout?.topCivs ?? []).slice(0, 3).map((c) => c.civ),
    isAI,
  }
}

function PlacedWidget({
  widgetKey,
  position,
  placementMode,
  zIndex,
  scale = 1,
  children,
  onPositionChange,
}: {
  widgetKey: OverlayWidgetKey
  position: OverlayWidgetPosition
  placementMode: boolean
  zIndex: number
  /** Widget scale, applied around the anchor corner so positions stay put. */
  scale?: number
  children: ReactNode
  onPositionChange: (key: OverlayWidgetKey, position: OverlayWidgetPosition) => void
}) {
  const [draft, setDraft] = useState<OverlayWidgetPosition | null>(null)
  const [drag, setDrag] = useState<{
    dx: number
    dy: number
    width: number
    height: number
  } | null>(null)
  const active = draft ?? position

  useEffect(() => {
    setDraft(null)
  }, [position.anchor, position.x, position.y])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!placementMode || e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDrag({
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    })
    setDraft({ anchor: 'top-left', x: rect.left, y: rect.top })
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const x = clamp(e.clientX - drag.dx, 0, Math.max(0, window.innerWidth - drag.width))
    const y = clamp(e.clientY - drag.dy, 0, Math.max(0, window.innerHeight - drag.height))
    setDraft({ anchor: 'top-left', x, y })
  }

  const onPointerUp = () => {
    if (drag && draft) onPositionChange(widgetKey, draft)
    setDrag(null)
  }

  return (
    <div
      className={placementMode ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}
      style={{ ...positionStyle(active, scale), zIndex }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={placementMode ? 'Move overlay widget' : undefined}
    >
      {placementMode && (
        <span className="pointer-events-none absolute -left-2 -top-3 z-[70] flex h-6 items-center gap-1 rounded-full bg-primary px-2 text-[10px] font-semibold text-primary-foreground shadow-lg ring-1 ring-black/50">
          <Move className="h-3 w-3" />
          {WIDGET_LABELS[widgetKey]}
        </span>
      )}
      <div className={placementMode ? 'rounded-md ring-1 ring-primary/70' : undefined}>
        {children}
      </div>
    </div>
  )
}

/** CSS transform-origin per anchor: scale grows AWAY from the anchored corner/edge. */
const SCALE_ORIGIN: Record<OverlayWidgetAnchor, string> = {
  'top-left': 'top left',
  'top-center': 'top center',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right',
  center: 'center',
}

function positionStyle(position: OverlayWidgetPosition, scale = 1): CSSProperties {
  const px = (n: number) => `${Math.round(n)}px`
  // Scale composes AFTER the centering translate (CSS applies right-to-left), so
  // the anchor point stays fixed and the saved position is scale-independent.
  const s = scale === 1 ? '' : ` scale(${scale})`
  const base: CSSProperties = {
    position: 'absolute',
    transformOrigin: SCALE_ORIGIN[position.anchor],
  }
  switch (position.anchor) {
    case 'top-center':
      return {
        ...base,
        left: `calc(50% + ${px(position.x)})`,
        top: px(position.y),
        transform: `translateX(-50%)${s}`,
      }
    case 'top-right':
      return { ...base, right: px(position.x), top: px(position.y), transform: s || undefined }
    case 'bottom-left':
      return { ...base, left: px(position.x), bottom: px(position.y), transform: s || undefined }
    case 'bottom-right':
      return { ...base, right: px(position.x), bottom: px(position.y), transform: s || undefined }
    case 'center':
      return {
        ...base,
        left: `calc(50% + ${px(position.x)})`,
        top: `calc(50% + ${px(position.y)})`,
        transform: `translate(-50%, -50%)${s}`,
      }
    case 'top-left':
    default:
      return { ...base, left: px(position.x), top: px(position.y), transform: s || undefined }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Mirror the settings range for overlay opacity ([0.3, 1], 1 when unset). */
function clampAlpha(value: number | undefined): number {
  return clamp(typeof value === 'number' && Number.isFinite(value) ? value : 1, 0.3, 1)
}

/** Mirror the settings range for overlay scale ([0.75, 1.5], 1 when unset). */
function clampScale(value: number | undefined): number {
  return clamp(typeof value === 'number' && Number.isFinite(value) ? value : 1, 0.75, 1.5)
}

/** Keep at least this many pixels of a widget inside the canvas when clamping. */
const MIN_VISIBLE = 40

/**
 * Clamps a saved widget position onto the current overlay canvas. Dragged
 * widgets are stored as absolute top-left pixels, so a position saved on a
 * larger display (or before a resolution change) can land entirely off-screen.
 * Edge/center anchors move with the window, but their offsets are clamped too
 * so a corrupt/huge offset can't push a widget out the far side.
 */
function clampPosition(pos: OverlayWidgetPosition): OverlayWidgetPosition {
  const w = window.innerWidth
  const h = window.innerHeight
  if (w <= 0 || h <= 0) return pos
  // Centered anchors offset from the canvas midpoint (translate(-50%)), so keep
  // the widget's CENTER at least MIN_VISIBLE inside both edges.
  const cx = Math.max(0, w / 2 - MIN_VISIBLE)
  const cy = Math.max(0, h / 2 - MIN_VISIBLE)
  switch (pos.anchor) {
    case 'top-center':
      return { ...pos, x: clamp(pos.x, -cx, cx), y: clamp(pos.y, 0, h - MIN_VISIBLE) }
    case 'center':
      return { ...pos, x: clamp(pos.x, -cx, cx), y: clamp(pos.y, -cy, cy) }
    default:
      // top-left absolute pixels, or edge offsets (top-right / bottom-*).
      return { ...pos, x: clamp(pos.x, 0, w - MIN_VISIBLE), y: clamp(pos.y, 0, h - MIN_VISIBLE) }
  }
}

function clampPositions(p: OverlayWidgetPositions): OverlayWidgetPositions {
  return {
    matchup: clampPosition(p.matchup),
    apm: clampPosition(p.apm),
    postGame: clampPosition(p.postGame),
    buildOrder: clampPosition(p.buildOrder),
    ageTargets: clampPosition(p.ageTargets),
    session: clampPosition(p.session),
  }
}
