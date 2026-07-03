import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { useAppInfo } from '../queries/useAppInfo'
import { PageHead } from '../components/PageHead'

export function About() {
  const { data } = useAppInfo()

  return (
    <div className="animate-fade-in space-y-6">
      <PageHead
        kicker="Colophon"
        title="About RTSLytics"
        sub={`Version ${data?.version ?? '…'} · ${data?.platform ?? '…'}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Not affiliated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            RTSLytics is an Age of Empires IV companion app. It is not affiliated
            with, endorsed by, or sponsored by Microsoft or Relic Entertainment.
          </p>
          <p>
            <em>Age of Empires IV</em> and all related assets are © Microsoft, used under
            Microsoft's Game Content Usage Rules.
          </p>
          <p>
            RTSLytics reads only public data and your own local game files (entirely on-device,
            never uploaded — see the README's local data disclaimer). It{' '}
            <strong className="text-foreground">never reads game memory</strong> or modifies the
            game.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li>AoE4World API — profiles, match history, match detection, civ/matchup stats</li>
            <li>aoe4world/data — vendored static game data (units, buildings, tech)</li>
            <li>CraftySalamander RTS_Overlay — build-order JSON format</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
