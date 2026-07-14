import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { CommandBar } from './components/CommandBar'
import { navItems } from './nav'
import { useSettings } from './queries/useProfile'
import { Onboarding } from './screens/Onboarding'
import { applyAccent } from '@shared/accent'
import { ipc } from '@shared/ipc'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import { CIV_FLAGS } from '@data/vendor/aoe4world-overlay/flags'
import menuBackdrop from '@shared/assets/strategy-menu-backdrop.jpg'

const CivDetail = lazy(() => import('./screens/CivDetail').then((m) => ({ default: m.CivDetail })))
const PlayerProfile = lazy(() =>
  import('./screens/PlayerProfile').then((m) => ({ default: m.PlayerProfile })),
)
const GameDetail = lazy(() =>
  import('./screens/GameDetail').then((m) => ({ default: m.GameDetail })),
)

/** Post-game auto-open: the main process pushes the finished game's id. */
function useOpenGamePush() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useEffect(
    () =>
      ipc.onOpenGame((matchId) => {
        // The game was just folded into history — make sure the list is fresh
        // before the detail view resolves the match from it. The dashboard's
        // ladder numbers (rating/rank/win rate) moved with it.
        void queryClient.invalidateQueries({ queryKey: ['history'] })
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        navigate(`/game/${matchId}`)
      }),
    [navigate, queryClient],
  )
}

/** The civ you're currently playing (pushed live), for civilization themes. */
function useLiveCivTheme(): string | null {
  const [civ, setCiv] = useState<string | null>(null)
  useEffect(() => ipc.onCivTheme(setCiv), [])
  return civ
}

export function App() {
  const { data: settings, isLoading } = useSettings()
  const location = useLocation()
  useOpenGamePush()
  const liveCiv = useLiveCivTheme()

  // Accent precedence: live civ theme (while a match is ongoing and the setting
  // is on) → the user's custom accent → the default parchment gold.
  useEffect(() => {
    const civHex =
      settings?.civTheme !== false && liveCiv ? (CIV_FLAGS[liveCiv]?.color ?? null) : null
    applyAccent(civHex ?? settings?.accentColor ?? null)
  }, [settings?.accentColor, settings?.civTheme, liveCiv])

  let content: ReactNode
  if (isLoading) {
    content = (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  } else if (!settings || settings.profileId == null) {
    content = <Onboarding />
  } else {
    content = (
      <main className="chronicle-main relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-10 py-7">
          {/* Keyed by path so navigating away resets a crashed screen. */}
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
              <Routes>
                {navItems.map((item) => (
                  <Route key={item.path} path={item.path} element={item.element} />
                ))}
                <Route path="/civ/:slug" element={<CivDetail />} />
                <Route path="/profile/:profileId" element={<PlayerProfile />} />
                <Route path="/game/:matchId" element={<GameDetail />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    )
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* App-wide backdrop, behind everything (incl. the command bar). */}
      <div
        className="rts-app-backdrop pointer-events-none fixed -inset-5 z-0 opacity-50"
        style={{ backgroundImage: `url(${menuBackdrop})` }}
      />
      <div className="rts-app-atmosphere pointer-events-none fixed inset-0 z-0" />
      <CommandBar />
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">{content}</div>
    </div>
  )
}
