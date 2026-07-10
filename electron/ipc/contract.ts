/**
 * The single source of truth for the IPC surface between the Electron main
 * process and the renderer windows. Pure types + channel-name constants — no
 * Electron or Node imports, so both `preload.ts` (main side) and the renderer
 * can import it. The exposed `RtslyticsApi` is what `window.rtslytics` provides.
 *
 * This contract grows one block per phase; the renderer never calls IPC
 * channels directly, only through the typed `window.rtslytics.*` methods.
 */
import type { RankInfo, RecentForm, ScoutReport } from '@domain/types'
import type { CivTier } from '@domain/tierList'
import type { MapStat } from '@domain/mapStats'
import type { LeaderboardRow } from '@domain/leaderboard'
import type { CivDetailStats } from '@domain/civDetailStats'
import type { LiveMatchInfo, LiveOpponent, LiveMatchup, MatchupPlayer } from '@domain/liveMatch'
import type { ReplayMatchup, ReplayPlayer } from '@domain/replay'
import type { AppSettings, AppSettingsPatch, OverlaySettings } from '@store/settings'
import type { SessionSummary } from '@domain/session'
import type { StoredMatch } from '@store/historyStore'
import type { MatchSummary } from '@domain/statsSummary'
import type { LocalMatch } from '@domain/localMatch'
import type { SteamAccount } from '@domain/steamAccounts'
import type { GameClock } from '@domain/localStats'
import type { LandmarkRecordRow } from '@domain/landmarkRecord'
import type { LandmarkStatRow } from '@domain/landmarkStats'
import type { Leaderboard, RankLevel, StatsLeaderboard } from '@api/types'

export type Platform = 'win32' | 'darwin' | 'linux' | (string & {})

export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  appPing: 'app:ping',
  appGetPlatform: 'app:getPlatform',
  // Phase 1
  profileSearch: 'profile:search',
  profileSetCurrent: 'profile:setCurrent',
  profileSetActive: 'profile:setActive',
  profileRemove: 'profile:remove',
  profileDashboard: 'profile:dashboard',
  scoutGet: 'scout:get',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  // Phase 2
  civMetaGet: 'civMeta:get',
  civDetailGet: 'civDetail:get',
  leaderboardGet: 'leaderboard:get',
  // Phase 3
  analysisAnalyzeRecent: 'analysis:analyzeRecent',
  analysisHistory: 'analysis:history',
  analysisGameSummary: 'analysis:gameSummary',
  analysisDeleteMatch: 'analysis:deleteMatch',
  civLandmarkRecord: 'civ:landmarkRecord',
  civLandmarkStats: 'civ:landmarkStats',
  steamAuthStatus: 'steam:authStatus',
  steamStartLogin: 'steam:startLogin',
  steamStartCredentialsLogin: 'steam:startCredentialsLogin',
  steamSubmitSteamGuardCode: 'steam:submitSteamGuardCode',
  steamLogout: 'steam:logout',
  steamTestRankedFetch: 'steam:testRankedFetch',
  // Phase 4 (main → overlay renderer pushes)
  overlayUpdate: 'overlay:update',
  // overlayControl is currently DORMANT: kept deliberately as the pipeline for
  // the planned overlay micro-coach (D55).
  overlayControl: 'overlay:control',
  overlayLock: 'overlay:lock',
  overlaySettings: 'overlay:settings',
  // Live game-clock anchor (sim start + pauses), pushed at 1s cadence by the
  // poll loop while a match is live; null on match end.
  overlayGameClock: 'overlay:gameClock',
  overlayApm: 'overlay:apm',
  // Phase 4.5
  localDataStatus: 'localData:status',
  // Phase 5
  overlayApplySettings: 'overlay:applySettings',
  overlayToggle: 'overlay:toggle',
  /** Toggle the draggable widget-placement preview (also available through the hotkey). */
  overlayTogglePlacement: 'overlay:togglePlacement',
  // Overlay renderer → main: post-game card interactivity. The locked overlay
  // is click-through; while the card is up the main process forwards mouse
  // moves, the renderer hit-tests its ✕ button, and these two channels toggle
  // real clicks on it / dismiss the card.
  overlayInteractive: 'overlay:interactive',
  overlayDismissPostGame: 'overlay:dismissPostGame',
  // Custom window chrome (the main window is frameless; the renderer draws its
  // own title bar + min/max/close, so it drives the window through these).
  windowMinimize: 'window:minimize',
  windowMaximizeToggle: 'window:maximizeToggle',
  windowClose: 'window:close',
  windowIsMaximized: 'window:isMaximized',
  windowMaximizedChanged: 'window:maximizedChanged',
  // Main-process → dashboard: open a stored game's full post-game summary
  // (pushed when a match ends, if openSummaryOnGameEnd is enabled).
  appOpenGame: 'app:openGame',
  // Main-process → dashboard: the live civ for civilization themes (slug while
  // a match is ongoing, null when it ends).
  appCivTheme: 'app:civTheme',
  // Steam community avatar for a SteamID64 (data URL, disk-cached).
  steamAvatar: 'steam:avatar',
  // Live match + launcher
  gameLive: 'game:live',
  gameLaunch: 'game:launch',
  gameLocalMatch: 'game:localMatch',
  steamDetect: 'steam:detect',
  replayLatest: 'replay:latest',
  matchupWinRate: 'matchup:winRate',
} as const

// Live-match + replay types live in the domain (so they're pure + unit-tested)
// and are re-exported here as part of the IPC surface.
export type { LiveMatchInfo, LiveOpponent, LiveMatchup, MatchupPlayer, ReplayMatchup, ReplayPlayer }

/** The most-recent local replay (custom/AI games included), split me vs opponents. */
export interface LatestReplay extends ReplayMatchup {
  /** File mtime of the replay (≈ when the game was played). */
  recordedAtMs: number
  /**
   * The human opponent resolved to an AoE4World profile via their Steam id — the
   * scout `match_history.jsn` can't give (it logs custom opponents as `-1`). Null
   * for vs-AI games or when the Steam id doesn't resolve.
   */
  opponent: PlayerSearchHit | null
}

export interface LaunchResult {
  ok: boolean
  message?: string
}

export interface LocalDataStatus {
  platform: string
  /** Whether the user has granted one-time consent (A1). */
  consentGranted: boolean
  /** consent + Windows + warnings.log present. */
  available: boolean
  gameDir: string
  logExists: boolean
}

export type OverlayMatchState = 'idle' | 'ongoing' | 'ended'

/** Post-game results card shown on the overlay after a match (win/loss + coaching). */
export interface PostGameSummary {
  result: 'win' | 'loss' | null
  /** Your civ slug. */
  civ: string | null
  oppCiv: string | null
  map: string | null
  /** Economy grade A–F, or null without local stats. */
  grade: string | null
  /** Average APM from the replay's command count, or null. */
  apm: number | null
  durationSec: number | null
  /** Things you did well (max ~3). */
  didWell: string[]
  /** Things to improve next game (max ~3). */
  improve: string[]
  vsAI: boolean
}

export interface OverlayUpdatePayload {
  matchState: OverlayMatchState
  scout: ScoutReport | null
  myCiv: string | null
  map: string | null
  startedAt: string | null
  /** True for a custom/private/vs-AI game (no live opponent scout available). */
  custom: boolean
  /** The opponent's civ slug when known (ranked live games); null otherwise. */
  oppCiv: string | null
  /** Opponent display name for custom/AI games (no scout); ranked uses `scout.name`. */
  oppName: string | null
  /** True when the opponent is an AI bot (no ladder rank / win-rate / favorite civs). */
  oppIsAI: boolean
  /** Full matchup (both teams, all players) for the top bar; null while unknown/idle. */
  matchup: LiveMatchup | null
  /** Game-mode label for the bar's center (e.g. "Ranked 1v1"); null when unknown. */
  kind: string | null
  /** Post-game results (win/loss + coaching), pushed on `ended` once analysis finishes. */
  postGame?: PostGameSummary | null
  /**
   * Today's session line (W–L + net rating), for the session-tracker widget.
   * Null until the first finished game of the local day.
   */
  session: SessionSummary | null
  /**
   * Stable identity of the current match (ranked `game_id`, or a per-match token
   * for custom games); null when not in a match. The overlay keys its one-shot
   * "new match" resets (auto-advance, build auto-select) on this so a duplicate
   * update (the post-scout refresh) or a transient ongoing→ended→ongoing flicker
   * never re-fires them mid-match and clobbers a manual override.
   */
  matchId: string | null
}

export type OverlayControlAction = 'next-bo' | 'prev-bo' | 'next-counter'

export interface CivMetaQuery {
  leaderboard?: StatsLeaderboard
  rankLevel?: RankLevel
}

/** Civ meta explorer payload: sortable civ rows + map popularity for a bracket. */
export interface CivMetaResult {
  civs: CivTier[]
  maps: MapStat[]
  leaderboard: string
  rankLevel: string | null
  totalCivGames: number
}

export interface LeaderboardQuery {
  leaderboard: Leaderboard
  page?: number
  /** ISO 3166-1 alpha-2 country code (lowercase), e.g. "us". */
  country?: string
}

/** The current user's standing on the selected ladder (if ranked). */
export interface LeaderboardYou {
  rank: number
  rating: number | null
  winRate: number | null
  games: number
}

export interface LeaderboardPage {
  rows: LeaderboardRow[]
  page: number
  perPage: number
  totalCount: number
  leaderboard: string
  you: LeaderboardYou | null
}

export interface AnalyzeResult {
  analyzed: number
  total: number
  backend: string
}

/** Steam connection state for the ranked-economy helper (D54). */
export interface SteamAuthStatus {
  /** True once logged into Steam and ready to fetch ranked summaries. */
  connected: boolean
  /** True while a QR login is awaiting approval. */
  connecting: boolean
  /** The signed-in Steam persona name, when known. */
  name: string | null
  /** The last login error, if any (shown to the user). */
  error: string | null
}

export type SteamGuardActionKind =
  | 'email-code'
  | 'device-code'
  | 'device-confirmation'
  | 'email-confirmation'
  | 'unknown'

export interface SteamGuardAction {
  type: SteamGuardActionKind
  detail: string | null
}

export interface SteamCredentialsLoginResult {
  actionRequired: boolean
  actions: SteamGuardAction[]
  message: string | null
}

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

/** A result envelope so the renderer always gets a typed value, never a throw. */
export interface IpcOk<T> {
  ok: true
  data: T
}
export type IpcErrorKind = 'api' | 'not_found' | 'network' | 'validation' | 'unknown'
export interface IpcErr {
  ok: false
  error: { kind: IpcErrorKind; message: string; status?: number }
}
export type IpcResult<T> = IpcOk<T> | IpcErr

/** A trimmed search hit for the onboarding / scout pickers. */
export interface PlayerSearchHit {
  profileId: number
  name: string
  country: string | null
  rankLevel: string | null
  rating: number | null
  lastGameAt: string | null
}

/** Dashboard payload for the current player. */
export interface DashboardData {
  profileId: number
  name: string
  country: string | null
  /** The profile's linked SteamID64 (AoE4World), for the Steam-account cross-reference; null if none. */
  steamId: string | null
  primary: RankInfo | null
  modes: RankInfo[]
  recentForm: RecentForm
}

/** The typed API exposed on `window.rtslytics`. */
export interface RtslyticsApi {
  getVersion(): Promise<string>
  ping(): Promise<'pong'>
  getPlatform(): Promise<Platform>
  // Phase 1
  searchPlayers(query: string): Promise<IpcResult<PlayerSearchHit[]>>
  setCurrentProfile(profileId: number, name: string): Promise<AppSettings>
  /** Switch the active account to an already-linked one. */
  setActiveProfile(profileId: number): Promise<AppSettings>
  /** Unlink an account (falls back to the next linked one, or onboarding). */
  removeAccount(profileId: number): Promise<AppSettings>
  getDashboard(): Promise<IpcResult<DashboardData>>
  scoutPlayer(profileId: number): Promise<IpcResult<ScoutReport>>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: AppSettingsPatch): Promise<AppSettings>
  // Phase 2
  getCivMeta(query: CivMetaQuery): Promise<IpcResult<CivMetaResult>>
  getCivDetailStats(civ: string): Promise<IpcResult<CivDetailStats>>
  getLeaderboard(query: LeaderboardQuery): Promise<IpcResult<LeaderboardPage>>
  // Phase 3
  analyzeRecentGames(count?: number): Promise<IpcResult<AnalyzeResult>>
  getHistory(limit?: number): Promise<IpcResult<StoredMatch[]>>
  /**
   * The full stat summary (build order + economy/score timelines) for a game,
   * decoded from the local `stats.rgs` (custom games today; the backend will feed
   * the byte-identical ranked blob through the same parser). Null when no summary
   * is available for that match id.
   */
  getGameSummary(matchId: string): Promise<IpcResult<MatchSummary | null>>
  /** Permanently removes one game from the local history (e.g. a desynced match the game never recorded). */
  deleteMatch(matchId: string): Promise<IpcResult<null>>
  /** Your own per-landmark W/L for a civ, from your synced games' summaries. */
  getLandmarkRecord(civ: string): Promise<IpcResult<LandmarkRecordRow[]>>
  /** Global landmark pick/win rates (AoE4World ageup analytics); [] when unavailable. */
  getLandmarkStats(civ: string): Promise<IpcResult<LandmarkStatRow[]>>
  /** Steam connection state for ranked economy (local QR-auth helper, D54). */
  getSteamAuthStatus(): Promise<SteamAuthStatus>
  /** Begin a QR login; returns the challenge URL to render. Poll status for completion. */
  steamStartLogin(): Promise<IpcResult<{ challengeUrl: string }>>
  /** Begin a username/password Steam login. Password is used for this request only and never persisted. */
  steamStartCredentialsLogin(
    accountName: string,
    password: string,
  ): Promise<IpcResult<SteamCredentialsLoginResult>>
  /** Submit the Steam Guard email/TOTP code for an active username/password login. */
  steamSubmitSteamGuardCode(code: string): Promise<IpcResult<SteamCredentialsLoginResult>>
  steamLogout(): Promise<void>
  /** Diagnostic: trace the ranked-summary fetch for the newest game (for debugging). */
  steamTestRankedFetch(): Promise<IpcResult<string>>
  // Phase 4 — overlay event subscriptions (each returns an unsubscribe fn)
  onOverlayUpdate(cb: (payload: OverlayUpdatePayload) => void): () => void
  onOverlayControl(cb: (action: OverlayControlAction) => void): () => void
  onOverlayLock(cb: (locked: boolean) => void): () => void
  /**
   * Overlay settings pushed when the user changes them (e.g. widget toggles),
   * plus the app-wide `accentColor` (the overlay follows the chosen accent too,
   * even though it isn't an overlay-only setting).
   */
  onOverlaySettings(
    cb: (
      overlay: OverlaySettings & {
        accentColor: AppSettings['accentColor']
        civTheme: AppSettings['civTheme']
      },
    ) => void,
  ): () => void
  /**
   * The accurate game-clock anchor (sim start + pauses), pushed every second
   * while in a match (re-anchored from the log each poll tick); null resets it
   * on match end. Derive elapsed with `gameElapsedSec(clock, todMsFromEpoch(now))`.
   */
  onOverlayGameClock(cb: (clock: GameClock | null) => void): () => void
  /** Live APM (actions in the last 60s), pushed while in a match; null when idle/off. */
  onOverlayApm(cb: (apm: number | null) => void): () => void
  // Phase 4.5
  getLocalDataStatus(): Promise<LocalDataStatus>
  // Phase 5
  applyOverlaySettings(): Promise<void>
  toggleOverlay(): Promise<void>
  /**
   * Enter/leave the draggable widget-placement preview. Resolves to whether
   * placement mode is active after the toggle.
   */
  toggleOverlayPlacement(): Promise<boolean>
  /** Overlay only: the cursor is over (or left) a clickable overlay control (post-game ✕). */
  setOverlayInteractive(hover: boolean): Promise<void>
  /** Overlay only: dismiss the post-game card and hide the overlay. */
  dismissOverlayPostGame(): Promise<void>
  // Custom window chrome (frameless main window — the renderer's title bar)
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  isWindowMaximized(): Promise<boolean>
  /** Fires when the window is maximized/unmaximized so the title bar can swap its icon. */
  onWindowMaximizedChanged(cb: (isMaximized: boolean) => void): () => void
  /** Fires when a finished match's summary should open (post-game auto-open). */
  onOpenGame(cb: (matchId: string) => void): () => void
  /** The live civ slug for civilization themes (null when no match is ongoing). */
  onCivTheme(cb: (civ: string | null) => void): () => void
  /** Steam community avatar for a SteamID64 as a data URL (null when unavailable). */
  getSteamAvatar(steamId: string): Promise<string | null>
  // Live match + launcher
  getLiveMatch(): Promise<LiveMatchInfo>
  launchGame(): Promise<LaunchResult>
  /** Latest parsed local match_history.jsn (custom games included); null without consent. */
  getLocalMatch(): Promise<LocalMatch | null>
  /** Steam accounts signed in on this machine (most-recent first); [] if none/non-Windows. */
  detectSteamAccounts(): Promise<SteamAccount[]>
  /** Most-recent local replay (custom/AI included) parsed to me-vs-opponents; null without consent. */
  getLatestReplay(): Promise<LatestReplay | null>
  /** Historical win rate (%) of your civ vs the opponent's civ; null if unknown. */
  getMatchupWinRate(civ: string, oppCiv: string): Promise<number | null>
}
