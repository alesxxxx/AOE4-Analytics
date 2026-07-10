import { app, ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from './contract'
import type { AppSettingsPatch } from '@store/settings'
import {
  getApmTracker,
  getOverlayController,
  getPollManager,
  getSettings,
} from '../services/appContext'
import { registerHotkeys } from '../hotkeys'
import { launchGame } from '../services/gameProcess'
import { getSteamAccounts, getSteamAvatar } from '../services/steamService'
import type { LiveMatchInfo } from './contract'
import { getDashboard, searchPlayers } from '../services/profileService'
import { scoutPlayer } from '../services/scoutService'
import { getCivMeta } from '../services/civMetaService'
import { getCivDetailStats, getLandmarkStats } from '../services/civDetailService'
import { getLeaderboardPage } from '../services/leaderboardService'
import {
  analyzeRecentGames,
  deleteMatch,
  getGameSummary,
  getLandmarkRecord,
  getMatchupWinRate,
  listHistory,
} from '../services/analysisService'
import {
  getLatestLocalMatch,
  getLatestReplay,
  getLocalDataStatus,
} from '../services/localDataService'
import {
  diagnoseRankedFetch,
  getSteamAuthStatus,
  steamLogout,
  steamStartCredentialsLogin,
  steamStartLogin,
  steamSubmitSteamGuardCode,
} from '../services/relicAuthService'
import { ok, errFrom } from '../services/result'
import { replayMatchup } from '@domain/replay'
import type { CivMetaQuery, LatestReplay, LeaderboardQuery } from './contract'

/**
 * Registers all `ipcMain.handle` channels. Called once from `main.ts` after
 * `app.whenReady()`. Handlers stay thin — they delegate to services that
 * compose the API client + domain logic.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion())
  ipcMain.handle(IpcChannels.appPing, () => 'pong' as const)
  ipcMain.handle(IpcChannels.appGetPlatform, () => process.platform)

  ipcMain.handle(IpcChannels.profileSearch, (_e, query: string) => searchPlayers(query))
  ipcMain.handle(IpcChannels.profileDashboard, () => getDashboard())
  ipcMain.handle(IpcChannels.scoutGet, (_e, profileId: number) => scoutPlayer(profileId))

  ipcMain.handle(IpcChannels.profileSetCurrent, (_e, profileId: number, name: string) =>
    getSettings().setProfile(profileId, name),
  )
  ipcMain.handle(IpcChannels.profileSetActive, (_e, profileId: number) =>
    getSettings().setActiveProfile(profileId),
  )
  ipcMain.handle(IpcChannels.profileRemove, (_e, profileId: number) =>
    getSettings().removeAccount(profileId),
  )
  ipcMain.handle(IpcChannels.settingsGet, () => getSettings().getAll())
  ipcMain.handle(IpcChannels.settingsUpdate, (_e, patch: AppSettingsPatch) => {
    const next = getSettings().update(patch)
    // Hotkey changes take effect immediately: re-register (old bindings are
    // unregistered first; a failed registration falls back to the default).
    if (patch && typeof patch === 'object' && 'hotkeys' in patch) {
      const overlay = getOverlayController()
      if (overlay) registerHotkeys(overlay)
    }
    return next
  })

  ipcMain.handle(IpcChannels.civMetaGet, (_e, query: CivMetaQuery) => getCivMeta(query))
  ipcMain.handle(IpcChannels.civDetailGet, (_e, civ: string) => getCivDetailStats(civ))
  ipcMain.handle(IpcChannels.leaderboardGet, (_e, query: LeaderboardQuery) =>
    getLeaderboardPage(query),
  )

  // analyzeRecentGames folds local custom/AI games itself — one coordinator.
  ipcMain.handle(IpcChannels.analysisAnalyzeRecent, (_e, count?: number) =>
    analyzeRecentGames(count),
  )
  ipcMain.handle(IpcChannels.analysisHistory, (_e, limit?: number) => listHistory(limit))
  ipcMain.handle(IpcChannels.analysisGameSummary, (_e, matchId: string) => getGameSummary(matchId))
  ipcMain.handle(IpcChannels.analysisDeleteMatch, (_e, matchId: string) => deleteMatch(matchId))
  ipcMain.handle(IpcChannels.civLandmarkRecord, (_e, civ: string) => getLandmarkRecord(civ))
  ipcMain.handle(IpcChannels.civLandmarkStats, (_e, civ: string) => getLandmarkStats(civ))

  ipcMain.handle(IpcChannels.steamAuthStatus, () => getSteamAuthStatus())
  ipcMain.handle(IpcChannels.steamStartLogin, async () => {
    try {
      return ok(await steamStartLogin())
    } catch (e) {
      return errFrom(e)
    }
  })
  ipcMain.handle(
    IpcChannels.steamStartCredentialsLogin,
    async (_e, accountName: string, password: string) => {
      try {
        return ok(await steamStartCredentialsLogin(accountName, password))
      } catch (e) {
        return errFrom(e)
      }
    },
  )
  ipcMain.handle(IpcChannels.steamSubmitSteamGuardCode, async (_e, code: string) => {
    try {
      return ok(await steamSubmitSteamGuardCode(code))
    } catch (e) {
      return errFrom(e)
    }
  })
  ipcMain.handle(IpcChannels.steamLogout, () => steamLogout())
  ipcMain.handle(IpcChannels.steamTestRankedFetch, async () => {
    try {
      const profileId = getSettings().getAll().profileId
      if (profileId == null) return errFrom(new Error('No profile set'))
      return ok(await diagnoseRankedFetch(profileId))
    } catch (e) {
      return errFrom(e)
    }
  })

  ipcMain.handle(IpcChannels.localDataStatus, () => getLocalDataStatus())

  ipcMain.handle(IpcChannels.overlayApplySettings, () => {
    const overlay = getOverlayController()
    overlay?.applyPosition() // snap to the current display's full bounds
    overlay?.refreshGating() // apply the "only show while AoE4 focused" toggle live
    // Push widget toggles + opacity to the overlay renderer (opacity is applied
    // there as panel-background alpha — never win.setOpacity, which dims text).
    overlay?.sendSettings()
    getApmTracker()?.setEnabled(getSettings().getAll().overlay.apm) // start/stop the live-APM hook
  })
  ipcMain.handle(IpcChannels.overlayToggle, () => {
    getOverlayController()?.toggle()
  })
  ipcMain.handle(IpcChannels.overlayTogglePlacement, () =>
    getOverlayController()?.togglePlacementMode() ?? false,
  )
  ipcMain.handle(IpcChannels.overlayInteractive, (_e, hover: unknown) => {
    getOverlayController()?.setInteractiveHover(hover === true)
  })
  ipcMain.handle(IpcChannels.overlayDismissPostGame, () => {
    getOverlayController()?.dismissPostGame()
  })

  // Custom window chrome — act on whichever window made the call (the frameless
  // main window). Using the sender's window avoids plumbing a window ref here.
  ipcMain.handle(IpcChannels.windowMinimize, (e) =>
    BrowserWindow.fromWebContents(e.sender)?.minimize(),
  )
  ipcMain.handle(IpcChannels.windowMaximizeToggle, (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle(IpcChannels.windowClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(
    IpcChannels.windowIsMaximized,
    (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false,
  )

  ipcMain.handle(
    IpcChannels.gameLive,
    (): LiveMatchInfo =>
      getPollManager()?.getLiveInfo() ?? {
        isLive: false,
        isStale: false,
        source: 'no-game',
        processRunning: null,
        custom: false,
        myCiv: null,
        opponent: null,
        map: null,
        startedAt: null,
      },
  )
  ipcMain.handle(IpcChannels.gameLaunch, () => launchGame())
  ipcMain.handle(IpcChannels.gameLocalMatch, () => getLatestLocalMatch())
  ipcMain.handle(IpcChannels.steamDetect, () => getSteamAccounts())
  ipcMain.handle(IpcChannels.steamAvatar, (_e, steamId: string) =>
    typeof steamId === 'string' ? getSteamAvatar(steamId) : null,
  )
  ipcMain.handle(IpcChannels.replayLatest, async (): Promise<LatestReplay | null> => {
    const r = getLatestReplay()
    if (!r) return null
    const accounts = await getSteamAccounts()
    const matchup = replayMatchup(
      r.info,
      accounts.map((a) => a.steamId),
    )
    // Resolve a HUMAN opponent's Steam id → AoE4World profile (the scout
    // match_history.jsn can't give). Skipped for vs-AI (no human opponent).
    let opponent = null
    const humanOpp = matchup.opponents.find((p) => !p.ai && p.steamId)
    if (humanOpp?.steamId) {
      const res = await searchPlayers(humanOpp.steamId)
      if (res.ok && res.data[0]) opponent = res.data[0]
    }
    return { ...matchup, recordedAtMs: r.recordedAtMs, opponent }
  })
  ipcMain.handle(IpcChannels.matchupWinRate, (_e, civ: string, oppCiv: string) =>
    getMatchupWinRate(civ, oppCiv),
  )
}
