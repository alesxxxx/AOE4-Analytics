import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CIV_PROFILES } from '@data/civProfiles'
import { BUNDLED_BUILD_ORDERS } from '@data/buildOrders'
import { buildIndexForCiv } from '@domain/buildOrderSchema'

/**
 * The beginner on-ramp (P1): easy civs that ALSO ship with a bundled build order,
 * so a new player gets a strong pick + a plan to follow in one click — the
 * "best champs to start on" pattern from op.gg / U.GG, mapped to AoE4 civs.
 */
const STARTER_CIVS = Object.values(CIV_PROFILES)
  .filter((c) => c.difficulty === 'easy' && buildIndexForCiv(BUNDLED_BUILD_ORDERS, c.slug) != null)
  .slice(0, 3)

export function RecommendedCivs() {
  if (STARTER_CIVS.length === 0) return null
  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        New here? Start with one of these
      </h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {STARTER_CIVS.map((c) => (
          <Link
            key={c.slug}
            to={`/civ/${c.slug}`}
            className="group rounded-md border border-border bg-card/60 p-3 transition-colors hover:border-primary/40 hover:bg-card"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.name}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-1 text-xs leading-snug text-muted-foreground">{c.focus}</div>
            <div className="mt-2 inline-flex rounded bg-win/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-win">
              Easy · build included
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
