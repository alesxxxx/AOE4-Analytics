import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type RtslyticsApi,
  type OverlayUpdatePayload,
  type OverlayControlAction,
} from './ipc/contract'

/** Subscribes to a main→renderer channel and returns an unsubscribe function. */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

/**
 * Preload bridge. Runs with `contextIsolation: true`, so the renderer cannot
 * touch Node or Electron directly — it only sees the typed `window.rtslytics`
 * surface defined here. Every method maps to an `ipcRenderer.invoke` of a
 * channel declared in the shared contract.
 */
const api: RtslyticsApi = {
  getVersion: () => ipcRenderer.invoke(IpcChannels.appGetVersion),
  ping: () => ipcRenderer.invoke(IpcChannels.appPing),
  getPlatform: () => ipcRenderer.invoke(IpcChannels.appGetPlatform),

  searchPlayers: (query) => ipcRenderer.invoke(IpcChannels.profileSearch, query),
  setCurrentProfile: (profileId, name) =>
    ipcRenderer.invoke(IpcChannels.profileSetCurrent, profileId, name),
  setActiveProfile: (profileId) => ipcRenderer.invoke(IpcChannels.profileSetActive, profileId),
  removeAccount: (profileId) => ipcRenderer.invoke(IpcChannels.profileRemove, profileId),
  getDashboard: () => ipcRenderer.invoke(IpcChannels.profileDashboard),
  scoutPlayer: (profileId) => ipcRenderer.invoke(IpcChannels.scoutGet, profileId),
  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IpcChannels.settingsUpdate, patch),

  getCivMeta: (query) => ipcRenderer.invoke(IpcChannels.civMetaGet, query),
  getCivDetailStats: (civ) => ipcRenderer.invoke(IpcChannels.civDetailGet, civ),
  getLeaderboard: (query) => ipcRenderer.invoke(IpcChannels.leaderboardGet, query),

  analyzeRecentGames: (count) => ipcRenderer.invoke(IpcChannels.analysisAnalyzeRecent, count),
  getHistory: (limit) => ipcRenderer.invoke(IpcChannels.analysisHistory, limit),
  getGameSummary: (matchId) => ipcRenderer.invoke(IpcChannels.analysisGameSummary, matchId),
  deleteMatch: (matchId) => ipcRenderer.invoke(IpcChannels.analysisDeleteMatch, matchId),
  getLandmarkRecord: (civ) => ipcRenderer.invoke(IpcChannels.civLandmarkRecord, civ),
  getLandmarkStats: (civ) => ipcRenderer.invoke(IpcChannels.civLandmarkStats, civ),
  getSteamAuthStatus: () => ipcRenderer.invoke(IpcChannels.steamAuthStatus),
  steamStartLogin: () => ipcRenderer.invoke(IpcChannels.steamStartLogin),
  steamStartCredentialsLogin: (accountName, password) =>
    ipcRenderer.invoke(IpcChannels.steamStartCredentialsLogin, accountName, password),
  steamSubmitSteamGuardCode: (code) =>
    ipcRenderer.invoke(IpcChannels.steamSubmitSteamGuardCode, code),
  steamLogout: () => ipcRenderer.invoke(IpcChannels.steamLogout),
  steamTestRankedFetch: () => ipcRenderer.invoke(IpcChannels.steamTestRankedFetch),

  onOverlayUpdate: (cb) => subscribe<OverlayUpdatePayload>(IpcChannels.overlayUpdate, cb),
  onOverlayControl: (cb) => subscribe<OverlayControlAction>(IpcChannels.overlayControl, cb),
  onOverlayLock: (cb) => subscribe<boolean>(IpcChannels.overlayLock, cb),
  onOverlaySettings: (cb) => subscribe(IpcChannels.overlaySettings, cb),
  onOverlayGameClock: (cb) => subscribe(IpcChannels.overlayGameClock, cb),
  onOverlayApm: (cb) => subscribe<number | null>(IpcChannels.overlayApm, cb),

  getLocalDataStatus: () => ipcRenderer.invoke(IpcChannels.localDataStatus),

  applyOverlaySettings: () => ipcRenderer.invoke(IpcChannels.overlayApplySettings),
  toggleOverlay: () => ipcRenderer.invoke(IpcChannels.overlayToggle),
  toggleOverlayPlacement: () => ipcRenderer.invoke(IpcChannels.overlayTogglePlacement),
  setOverlayInteractive: (hover) => ipcRenderer.invoke(IpcChannels.overlayInteractive, hover),
  dismissOverlayPostGame: () => ipcRenderer.invoke(IpcChannels.overlayDismissPostGame),

  minimizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMaximizeToggle),
  closeWindow: () => ipcRenderer.invoke(IpcChannels.windowClose),
  isWindowMaximized: () => ipcRenderer.invoke(IpcChannels.windowIsMaximized),
  onWindowMaximizedChanged: (cb) => subscribe<boolean>(IpcChannels.windowMaximizedChanged, cb),
  onOpenGame: (cb) => subscribe<string>(IpcChannels.appOpenGame, cb),
  onCivTheme: (cb) => subscribe<string | null>(IpcChannels.appCivTheme, cb),
  getSteamAvatar: (steamId) => ipcRenderer.invoke(IpcChannels.steamAvatar, steamId),

  getLiveMatch: () => ipcRenderer.invoke(IpcChannels.gameLive),
  launchGame: () => ipcRenderer.invoke(IpcChannels.gameLaunch),
  getLocalMatch: () => ipcRenderer.invoke(IpcChannels.gameLocalMatch),
  detectSteamAccounts: () => ipcRenderer.invoke(IpcChannels.steamDetect),
  getLatestReplay: () => ipcRenderer.invoke(IpcChannels.replayLatest),
  getMatchupWinRate: (civ, oppCiv) => ipcRenderer.invoke(IpcChannels.matchupWinRate, civ, oppCiv),
}

contextBridge.exposeInMainWorld('rtslytics', api)
