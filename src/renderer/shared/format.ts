/** Renderer-side display formatting helpers (pure). */

const LEADERBOARD_NAMES: Record<string, string> = {
  rm_solo: 'Ranked 1v1',
  rm_team: 'Ranked Team',
  rm_1v1: 'Ranked 1v1',
  rm_2v2: 'Ranked 2v2',
  rm_3v3: 'Ranked 3v3',
  rm_4v4: 'Ranked 4v4',
  qm_1v1: 'Quick Match 1v1',
  qm_2v2: 'Quick Match 2v2',
  qm_3v3: 'Quick Match 3v3',
  qm_4v4: 'Quick Match 4v4',
  qm_ffa: 'Quick Match FFA',
}

/** Friendly leaderboard label, e.g. 'rm_1v1_elo' → 'Ranked 1v1 (Elo)', 'qm_2v2' → 'Quick Match 2v2'. */
export function formatLeaderboard(key: string | null | undefined): string {
  if (!key) return '—'
  const elo = /_elo$/.test(key)
  const ew = /_ew$/.test(key)
  const base = key
    .replace(/_elo$/, '')
    .replace(/_ew$/, '')
    .replace(/_console$/, '')

  let label = LEADERBOARD_NAMES[base]
  if (!label) {
    const m = /^(rm|qm)_(\d)v(\d)/.exec(base)
    if (m) label = `${m[1] === 'rm' ? 'Ranked' : 'Quick Match'} ${m[2]}v${m[3]}`
    else label = key
  }
  if (elo) label += ' (Elo)'
  if (ew) label += ' (Empire Wars)'
  if (/_console$/.test(key)) label += ' (Console)'
  return label
}

/** 'gold_2' → 'Gold 2', 'unranked' → 'Unranked', null → 'Unranked'. */
export function formatRankLevel(rankLevel: string | null | undefined): string {
  if (!rankLevel || rankLevel === 'unranked') return 'Unranked'
  return rankLevel
    .split('_')
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

/** Base tier name for theming, e.g. 'gold_2' → 'gold'. */
export function rankTier(rankLevel: string | null | undefined): string {
  if (!rankLevel || rankLevel === 'unranked') return 'unranked'
  return rankLevel.split('_')[0] ?? 'unranked'
}

const RANK_COLORS: Record<string, string> = {
  bronze: '#a9744f',
  silver: '#b8c2cc',
  gold: '#f1c40f',
  platinum: '#3fd0c9',
  diamond: '#6ca9ff',
  conqueror: '#ff5e7a',
  unranked: '#6b7280',
}

export function rankColor(rankLevel: string | null | undefined): string {
  return RANK_COLORS[rankTier(rankLevel)] ?? RANK_COLORS['unranked']!
}

/** Win-rate → semantic tone, so every win-rate read is colored consistently. */
export function winRateTone(winRate: number | null | undefined): 'win' | 'loss' | 'even' {
  if (winRate == null) return 'even'
  if (winRate >= 52) return 'win'
  if (winRate < 48) return 'loss'
  return 'even'
}

export function formatRating(rating: number | null | undefined): string {
  return rating == null ? '—' : String(Math.round(rating))
}

/**
 * The one way a percentage renders app-wide: whole number + '%', '—' when
 * unknown. Domain math keeps its decimals; only the display rounds, so the
 * same win rate can never show as "52.3%" on one screen and "52%" on another.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

/** 2-letter ISO country code → flag emoji (empty string if invalid). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  const base = 0x1f1e6
  const cc = code.toUpperCase()
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65))
}

/** ISO timestamp → coarse relative time, e.g. '3d ago'. */
export function relativeTime(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return ''
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, nowMs - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mon = Math.floor(day / 30)
  if (mon < 12) return `${mon}mo ago`
  return `${Math.floor(mon / 12)}y ago`
}

export function formatDurationShort(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
