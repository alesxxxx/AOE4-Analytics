import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, CheckCircle2, Gamepad2, KeyRound, Loader2 } from 'lucide-react'
import type { SteamGuardAction } from '@ipc/contract'
import { ipc } from '@shared/ipc'
import { Card, CardContent } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import {
  useSteamAuthStatus,
  useSteamLogout,
  useSteamStartCredentialsLogin,
  useSteamStartLogin,
  useSteamSubmitSteamGuardCode,
} from '../queries/useSteam'

/**
 * Connect Steam so RTSLytics can pull ranked economy/build-order summaries from
 * Relic (D54). QR is safest, but username/password + Steam Guard is available
 * for accounts that do not use the mobile QR flow. Passwords are never stored.
 */
export function SteamConnectCard() {
  const { data: status } = useSteamAuthStatus()
  const startLogin = useSteamStartLogin()
  const startCredentialsLogin = useSteamStartCredentialsLogin()
  const submitSteamGuard = useSteamSubmitSteamGuardCode()
  const logout = useSteamLogout()
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [guardCode, setGuardCode] = useState('')
  const [guardActions, setGuardActions] = useState<SteamGuardAction[]>([])
  const [manualMessage, setManualMessage] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [diag, setDiag] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const connected = status?.connected ?? false
  const connecting = status?.connecting ?? false
  const needsGuardCode = guardActions.some(
    (a) => a.type === 'email-code' || a.type === 'device-code',
  )
  const waitingForApproval = guardActions.some(
    (a) => a.type === 'device-confirmation' || a.type === 'email-confirmation',
  )

  useEffect(() => {
    if (!connected) return
    setQrSrc(null)
    setManualOpen(false)
    setPassword('')
    setGuardCode('')
    setGuardActions([])
    setManualMessage(null)
  }, [connected])

  async function connect() {
    setStartError(null)
    setQrSrc(null)
    setManualMessage(null)
    setGuardActions([])
    const res = await startLogin.mutateAsync()
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    try {
      setQrSrc(await QRCode.toDataURL(res.data.challengeUrl, { margin: 1, width: 200 }))
    } catch {
      setStartError('Could not render the QR code.')
    }
  }

  async function connectWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStartError(null)
    setManualMessage(null)
    setQrSrc(null)
    setGuardActions([])
    const res = await startCredentialsLogin.mutateAsync({ accountName, password })
    setPassword('')
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    setGuardActions(res.data.actions)
    setManualMessage(res.data.message ?? manualLoginMessage(res.data.actions, res.data.actionRequired))
  }

  async function submitGuardCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStartError(null)
    setManualMessage(null)
    const res = await submitSteamGuard.mutateAsync(guardCode)
    setGuardCode('')
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    setGuardActions(res.data.actions)
    setManualMessage(res.data.message ?? 'Waiting for Steam to finish sign-in.')
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Steam connection (ranked economy)</h3>
          {connected && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-win">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              {status?.name ? ` - ${status.name}` : ''}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Ranked build-order and economy come from Relic, which needs a one-time Steam sign-in.
          Use QR approval, or sign in with your Steam password plus whatever Steam Guard email/app
          code Steam asks for. The saved login token is encrypted on this PC only.
        </p>

        {status?.error && !connecting && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {status.error}
          </p>
        )}
        {startError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {startError}
          </p>
        )}

        {!connected && qrSrc && (
          <div className="flex items-center gap-4 rounded-lg border border-border p-3">
            <img src={qrSrc} alt="Steam login QR code" className="h-40 w-40 rounded bg-white p-1" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Scan with the Steam mobile app</p>
              <p>Open Steam, choose QR scan or Steam Guard, point it here, then approve.</p>
              {connecting && (
                <p className="flex items-center gap-1.5 text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for approval...
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <>
              <button
                type="button"
                onClick={connect}
                disabled={startLogin.isPending || startCredentialsLogin.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {startLogin.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {qrSrc ? 'Show a new QR' : 'Connect with QR'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualOpen((v) => !v)
                  setStartError(null)
                  setManualMessage(null)
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Password / email code
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
              >
                Disconnect / re-login
              </button>
              <button
                type="button"
                onClick={async () => {
                  setTesting(true)
                  setDiag(null)
                  const res = await ipc.steamTestRankedFetch()
                  setDiag(res.ok ? res.data : `Error: ${res.error.message}`)
                  setTesting(false)
                }}
                disabled={testing}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
              >
                {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Test ranked fetch
              </button>
            </>
          )}
        </div>

        {!connected && manualOpen && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={connectWithPassword}>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Steam account name"
                autoComplete="username"
                disabled={startCredentialsLogin.isPending || connecting}
              />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                disabled={startCredentialsLogin.isPending || connecting}
              />
              <button
                type="submit"
                disabled={startCredentialsLogin.isPending || connecting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {startCredentialsLogin.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Sign in
              </button>
            </form>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Use this when QR login is not available. Your password is used only for this Steam
              login attempt and is not stored by RTSLytics.
            </p>

            {(manualMessage || guardActions.length > 0) && (
              <div className="space-y-2 rounded-md border border-border/70 bg-secondary/35 p-2 text-xs text-muted-foreground">
                {manualMessage && <p>{manualMessage}</p>}
                {guardActions.length > 0 && (
                  <p>Steam requested: {guardActions.map(guardActionLabel).join(', ')}.</p>
                )}
                {waitingForApproval && (
                  <p className="flex items-center gap-1.5 text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for approval...
                  </p>
                )}
              </div>
            )}

            {needsGuardCode && (
              <form className="flex gap-2" onSubmit={submitGuardCode}>
                <Input
                  value={guardCode}
                  onChange={(e) => setGuardCode(e.target.value)}
                  placeholder="Steam Guard code"
                  autoComplete="one-time-code"
                  disabled={submitSteamGuard.isPending}
                />
                <button
                  type="submit"
                  disabled={submitSteamGuard.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  {submitSteamGuard.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit code
                </button>
              </form>
            )}
          </div>
        )}

        {diag && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
            {diag}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

function guardActionLabel(action: SteamGuardAction): string {
  switch (action.type) {
    case 'email-code':
      return action.detail ? `email code (${action.detail})` : 'email code'
    case 'device-code':
      return 'authenticator code'
    case 'device-confirmation':
      return 'Steam mobile app approval'
    case 'email-confirmation':
      return 'email approval'
    default:
      return 'additional verification'
  }
}

function manualLoginMessage(actions: SteamGuardAction[], actionRequired: boolean): string {
  if (!actionRequired) return 'Steam accepted the credentials. Finishing sign-in...'
  if (actions.some((a) => a.type === 'email-code')) {
    return 'Steam sent an email code. Enter it below to finish connecting.'
  }
  if (actions.some((a) => a.type === 'device-code')) {
    return 'Enter the Steam Guard authenticator code to finish connecting.'
  }
  if (actions.some((a) => a.type === 'device-confirmation')) {
    return 'Approve the sign-in prompt in the Steam mobile app.'
  }
  if (actions.some((a) => a.type === 'email-confirmation')) {
    return 'Approve the sign-in email from Steam.'
  }
  return 'Steam needs one more verification step to finish connecting.'
}
