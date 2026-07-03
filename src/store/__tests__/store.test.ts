import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonStore } from '../jsonStore'
import { MemoryStore } from '../memoryStore'
import { SettingsService, DEFAULT_SETTINGS, DEFAULT_OVERLAY_WIDGET_POSITIONS } from '../settings'

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
    expect(all.overlay.width).toBe(DEFAULT_SETTINGS.overlay.width)
    expect(all.overlay.widgetPositions).toEqual(DEFAULT_OVERLAY_WIDGET_POSITIONS)
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
