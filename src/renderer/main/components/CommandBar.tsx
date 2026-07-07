import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Copy, Info, Landmark, Minus, Settings as SettingsIcon, Square, X } from 'lucide-react'
import { ipc } from '@shared/ipc'
import { cn } from '@shared/lib/utils'
import { navItems } from '../nav'
import { useSettings } from '../queries/useProfile'
import { AccountSwitcher } from './AccountSwitcher'

/**
 * The app's single top bar — launcher style. One row carries the brand (once),
 * the nav ribbon, the account chip, and the window controls; it is also the
 * frameless window's drag handle. Replaces the old sidebar + title bar.
 */
export function CommandBar() {
  const { data: settings } = useSettings()
  const hasProfile = settings?.profileId != null
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    ipc
      .isWindowMaximized()
      .then(setMaximized)
      .catch(() => {})
    return ipc.onWindowMaximizedChanged(setMaximized)
  }, [])

  const main = navItems.filter((i) => i.group === 'main')

  return (
    <header className="drag-region relative z-40 flex h-12 shrink-0 select-none items-stretch border-b border-border bg-card/95">
      {/* Brand — the only place the name appears. */}
      <div className="flex items-center gap-2.5 pl-4 pr-6">
        <Landmark className="h-4 w-4 text-primary" />
        <span className="whitespace-nowrap font-display text-[13px] font-bold tracking-[0.18em] text-foreground">
          RTSLytics
        </span>
      </div>

      {/* Nav ribbon */}
      {hasProfile && (
        <nav className="no-drag flex items-stretch">
          {main.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center px-4 font-display text-[12px] font-semibold tracking-[0.1em] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {/* Gold underline rail, like the game's ribbon menus. */}
                  <span
                    className={cn(
                      'absolute inset-x-3 bottom-0 h-0.5 bg-primary transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Drag gutter */}
      <div className="min-w-6 flex-1" />

      {/* Right cluster: settings/about, account, window controls */}
      <div className="no-drag flex items-center gap-1 pr-1">
        {hasProfile && (
          <>
            <IconNav to="/settings" title="Settings">
              <SettingsIcon className="h-4 w-4" />
            </IconNav>
            <IconNav to="/about" title="About">
              <Info className="h-4 w-4" />
            </IconNav>
            <div className="mx-2 h-5 w-px bg-border" aria-hidden />
            <div className="w-52">
              <AccountSwitcher />
            </div>
            <div className="mx-2 h-5 w-px bg-border" aria-hidden />
          </>
        )}
        <WinButton label="Minimize" onClick={() => void ipc.minimizeWindow()}>
          <Minus className="h-3.5 w-3.5" />
        </WinButton>
        <WinButton
          label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void ipc.toggleMaximizeWindow()}
        >
          {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </WinButton>
        <WinButton label="Close" danger onClick={() => void ipc.closeWindow()}>
          <X className="h-4 w-4" />
        </WinButton>
      </div>
    </header>
  )
}

function IconNav({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      title={title}
      className={({ isActive }) =>
        cn(
          'flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

function WinButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-12 w-11 items-center justify-center text-muted-foreground transition-colors',
        danger
          ? 'hover:bg-destructive hover:text-destructive-foreground'
          : 'hover:bg-foreground/10 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
