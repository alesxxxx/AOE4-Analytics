import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonStore } from '../jsonStore'
import { MemoryStore } from '../memoryStore'
import {
  SettingsService,
  DEFAULT_SETTINGS,
  DEFAULT_OVERLAY_WIDGET_POSITIONS,
  sanitizePatch,
  type AppSettingsPatch,
} from '../settings'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rtslytics-store-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('JsonStore', () => {
  it('set/get/has/delete', () => {
    const store = new JsonStore(join(dir, 'a', 'data.json'))
    expect(store.get('x')).toBeUndefined()
    store.set('x', { n: 1 })
    expect(store.has('x')).toBe(true)
    expect(store.get<{ n: number }>('x')).toEqual({ n: 1 })
    store.delete('x')
    expect(store.has('x')).toBe(false)
  })

  it('persists across instances', () => {
    const file = join(dir, 'data.json')
    new JsonStore(file).set('k', 'v')
    expect(new JsonStore(file).get('k')).toBe('v')
  })

  it('loads a corrupt file as empty without throwing', () => {
    const file = join(dir, 'data.json')
    writeFileSync(file, 'not json at all', 'utf8')
    const store = new JsonStore(file)
    expect(store.all()).toEqual({})
  })
})

describe('SettingsService', () => {
  it('returns defaults when nothing is stored', () => {
    const svc = new SettingsService(new MemoryStore())
    expect(svc.getAll()).toEqual(DEFAULT_SETTINGS)
    expect(svc.hasProfile()).toBe(false)
  })

  it('merges nested overlay/polling/localData over defaults', () => {
    const svc = new SettingsService(new MemoryStore())
    svc.update({ overlay: { ...DEFAULT_SETTINGS.overlay, opacity: 0.5 } })
    const all = svc.getAll()
    expect(all.overlay.opacity).toBe(0.5)
    expect(all.overlay.position).toBe(DEFAULT_SETTINGS.overlay.position)
    expect(all.overlay.widgetPositions).toEqual(DEFAULT_OVERLAY_WIDGET_POSITIONS)
    expect(all.hotkeys).toEqual(DEFAULT_SETTINGS.hotkeys)
    expect(all.polling).toEqual(DEFAULT_SETTINGS.polling)
  })

  it('persists the profile through a JsonStore', () => {
    const file = join(dir, 'settings.json')
    new SettingsService(new JsonStore(file)).setProfile(10240693, 'Beastyqt')
    const reloaded = new SettingsService(new JsonStore(file))
    expect(reloaded.hasProfile()).toBe(true)
    expect(reloaded.getAll().profileId).toBe(10240693)
    expect(reloaded.getAll().playerName).toBe('Beastyqt')
  })

  it('setProfile links the account and makes it active', () => {
    const svc = new SettingsService(new MemoryStore())
    svc.setProfile(1, 'One')
    svc.setProfile(2, 'Two')
    const all = svc.getAll()
    expect(all.profileId).toBe(2)
    expect(all.accounts).toEqual([
      { profileId: 1, name: 'One' },
      { profileId: 2, name: 'Two' },
    ])
    // re-adding an existing account doesn't duplicate it
    svc.setProfile(1, 'One')
    expect(svc.getAll().accounts).toHaveLength(2)
    expect(svc.getAll().profileId).toBe(1)
  })

  it('setActiveProfile switches between linked accounts only', () => {
    const svc = new SettingsService(new MemoryStore())
    svc.setProfile(1, 'One')
    svc.setProfile(2, 'Two')
    expect(svc.setActiveProfile(1).profileId).toBe(1)
    expect(svc.getAll().playerName).toBe('One')
    // unknown id is a no-op
    expect(svc.setActiveProfile(999).profileId).toBe(1)
  })

  it('removeAccount unlinks and falls back to a remaining account', () => {
    const svc = new SettingsService(new MemoryStore())
    svc.setProfile(1, 'One')
    svc.setProfile(2, 'Two') // active = 2
    const after = svc.removeAccount(2)
    expect(after.accounts).toEqual([{ profileId: 1, name: 'One' }])
    expect(after.profileId).toBe(1) // fell back
    // removing the last account clears the active profile
    const empty = svc.removeAccount(1)
    expect(empty.accounts).toEqual([])
    expect(empty.profileId).toBeNull()
  })

  it('migrates a pre-multi-account install (single profileId) into accounts[]', () => {
    const store = new MemoryStore()
    store.set('settings', { profileId: 42, playerName: 'Legacy' })
    const all = new SettingsService(store).getAll()
    expect(all.accounts).toEqual([{ profileId: 42, name: 'Legacy' }])
  })
})

describe('sanitizePatch', () => {
  it('drops unknown top-level keys', () => {
    const patch = { civTheme: true, injected: 'evil' } as AppSettingsPatch
    expect(sanitizePatch(patch)).toEqual({ civTheme: true })
  })

  it('clamps polling intervals and overlay opacity', () => {
    const out = sanitizePatch({
      polling: { idleIntervalMs: 1, activeIntervalMs: -5 },
      overlay: { opacity: 99 },
    })
    expect(out.polling).toEqual({ idleIntervalMs: 8000, activeIntervalMs: 4000 })
    expect(out.overlay).toEqual({ opacity: 1 })
  })

  it('drops non-finite numbers and coerces numeric strings', () => {
    const out = sanitizePatch({
      recentGamesCount: 'NaN',
      profileId: '123',
      overlay: { opacity: '0.5' },
    } as never)
    expect(out).toEqual({ profileId: 123, overlay: { opacity: 0.5 } })
  })

  it('validates hotkeys as accelerators with at least one modifier', () => {
    expect(sanitizePatch({ hotkeys: { toggleOverlay: 'Ctrl+Shift+O' } })).toEqual({
      hotkeys: { toggleOverlay: 'Ctrl+Shift+O' },
    })
    // whitespace around "+" is normalized away
    expect(sanitizePatch({ hotkeys: { placementMode: 'Ctrl + Alt + O' } })).toEqual({
      hotkeys: { placementMode: 'Ctrl+Alt+O' },
    })
    // no modifier / unknown modifier / trailing "+" / modifier-only are all dropped
    expect(sanitizePatch({ hotkeys: { toggleOverlay: 'O' } })).toEqual({ hotkeys: {} })
    expect(sanitizePatch({ hotkeys: { toggleOverlay: 'Foo+O' } })).toEqual({ hotkeys: {} })
    expect(sanitizePatch({ hotkeys: { placementMode: 'Ctrl+' } })).toEqual({ hotkeys: {} })
    expect(sanitizePatch({ hotkeys: { placementMode: 'Ctrl+Shift' } })).toEqual({ hotkeys: {} })
    expect(sanitizePatch({ hotkeys: { toggleOverlay: 42 } as never })).toEqual({ hotkeys: {} })
  })

  it('accepts only #rrggbb accent colours (or null)', () => {
    expect(sanitizePatch({ accentColor: '#00FFaa' })).toEqual({ accentColor: '#00FFaa' })
    expect(sanitizePatch({ accentColor: null })).toEqual({ accentColor: null })
    expect(sanitizePatch({ accentColor: 'red' })).toEqual({})
    expect(sanitizePatch({ accentColor: '#00ffaa; url(x)' })).toEqual({})
  })

  it('coerces booleans and validates enums', () => {
    const out = sanitizePatch({
      civTheme: 1 as never,
      leaderboard: 'nope' as never,
      overlay: { locked: 0 as never, apmCorner: 'middle' as never, troopsPos: 'bar' },
    })
    expect(out).toEqual({ civTheme: true, overlay: { locked: false, troopsPos: 'bar' } })
  })

  it('keeps gameDir string-or-null and drops other shapes', () => {
    expect(sanitizePatch({ localData: { gameDir: 'C:\\Games' } }).localData).toEqual({
      gameDir: 'C:\\Games',
    })
    expect(sanitizePatch({ localData: { gameDir: null } }).localData).toEqual({ gameDir: null })
    expect(sanitizePatch({ localData: { gameDir: 5 as never } }).localData).toEqual({})
  })

  it('clamps overlay scale to [0.75, 1.5] and drops junk', () => {
    expect(sanitizePatch({ overlay: { scale: 99 } }).overlay).toEqual({ scale: 1.5 })
    expect(sanitizePatch({ overlay: { scale: 0.1 } }).overlay).toEqual({ scale: 0.75 })
    expect(sanitizePatch({ overlay: { scale: 1.25 } }).overlay).toEqual({ scale: 1.25 })
    expect(sanitizePatch({ overlay: { scale: 'big' as never } }).overlay).toEqual({})
  })

  it('keeps buildOrderId string-or-null and coerces showAgeTargets to boolean', () => {
    expect(sanitizePatch({ overlay: { buildOrderId: 'English Longbow 2TC' } }).overlay).toEqual({
      buildOrderId: 'English Longbow 2TC',
    })
    expect(sanitizePatch({ overlay: { buildOrderId: null } }).overlay).toEqual({
      buildOrderId: null,
    })
    expect(sanitizePatch({ overlay: { buildOrderId: 5 as never } }).overlay).toEqual({})
    expect(sanitizePatch({ overlay: { showAgeTargets: 0 as never } }).overlay).toEqual({
      showAgeTargets: false,
    })
  })

  it('accepts positions for the buildOrder and ageTargets widgets', () => {
    const out = sanitizePatch({
      overlay: {
        widgetPositions: {
          buildOrder: { anchor: 'top-left', x: 20, y: 120 },
          ageTargets: { anchor: 'top-right', x: 8, y: 60 },
        } as never,
      },
    })
    expect(out.overlay?.widgetPositions).toEqual({
      buildOrder: { anchor: 'top-left', x: 20, y: 120 },
      ageTargets: { anchor: 'top-right', x: 8, y: 60 },
    })
  })

  it('filters malformed accounts and widget positions', () => {
    const out = sanitizePatch({
      accounts: [{ profileId: 1, name: 'One' }, { profileId: 'x', name: 2 }, 'junk'] as never,
      overlay: {
        widgetPositions: {
          apm: { anchor: 'bottom-left', x: 1, y: 2 },
          matchup: { anchor: 'sideways', x: 0, y: 0 },
        } as never,
      },
    })
    expect(out.accounts).toEqual([{ profileId: 1, name: 'One' }])
    expect(out.overlay?.widgetPositions).toEqual({ apm: { anchor: 'bottom-left', x: 1, y: 2 } })
  })

  it('is applied by update()', () => {
    const svc = new SettingsService(new MemoryStore())
    const all = svc.update({
      accentColor: 'javascript:alert(1)',
      polling: { activeIntervalMs: 10 },
    } as AppSettingsPatch)
    expect(all.accentColor).toBeNull()
    expect(all.polling.activeIntervalMs).toBe(4000)
  })
})
