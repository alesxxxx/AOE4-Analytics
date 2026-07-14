import { describe, expect, it } from 'vitest'
import type { BuildOrder } from '../buildOrderSchema'
import type { TrainerCheckpoint, TrainerReport } from '../buildTrainer'
import { buildRecoveryPlan, liveBuildForkPlan } from '../adaptiveBuild'

const R = { food: 0, wood: 0, gold: 0, stone: 0 }

const reference: BuildOrder = {
  name: 'English 2TC',
  civilization: 'English',
  build_order: [
    { population_count: 6, villager_count: 6, age: 1, resources: R, notes: ['Open'] },
    {
      population_count: 14,
      villager_count: 13,
      age: 2,
      resources: R,
      notes: ['Build a Barracks and add Spearmen if your opponent is aggressive.'],
      time: '5:00',
    },
  ],
}

function report(checkpoints: TrainerCheckpoint[]): TrainerReport {
  return { buildName: reference.name, checkpoints, score: 0 }
}

describe('buildRecoveryPlan', () => {
  it('separates late-age evidence from actionable recovery advice', () => {
    const plan = buildRecoveryPlan(
      report([
        {
          kind: 'ageup',
          ageUpTo: 2,
          label: 'Feudal landmark',
          targetTimeSec: 300,
          actualTimeSec: 402,
          deltaSec: 102,
          ok: false,
        },
      ]),
    )

    expect(plan).toEqual([
      expect.objectContaining({
        kind: 'late-age',
        evidence: 'Feudal landmark completed at 6:42, 1:42 after the 5:00 target.',
      }),
    ])
    expect(plan[0]!.advice).toContain('aim to complete the landmark by 5:00')
    expect(plan[0]!.evidence).not.toContain('Practice')
  })

  it('selects the largest villager deficit deterministically', () => {
    const plan = buildRecoveryPlan(
      report([
        {
          kind: 'villagers',
          label: 'Villagers @ 5:00',
          targetTimeSec: 300,
          targetVillagers: 13,
          actualVillagers: 10,
          villagerDelta: -3,
          ok: false,
        },
        {
          kind: 'villagers',
          label: 'Villagers @ 8:00',
          targetTimeSec: 480,
          targetVillagers: 25,
          actualVillagers: 19,
          villagerDelta: -6,
          ok: false,
        },
      ]),
    )

    expect(plan[0]).toMatchObject({
      kind: 'villager-deficit',
      title: 'Villagers at 8:00',
      evidence: '19 villagers were recorded against a target of 25 (6 behind).',
    })
  })

  it('groups missing checkpoints without treating missing decoded data as a failure', () => {
    const plan = buildRecoveryPlan(
      report([
        {
          kind: 'villagers',
          label: 'Villagers @ 5:00',
          targetTimeSec: 300,
          targetVillagers: 13,
          actualVillagers: null,
          villagerDelta: null,
          ok: null,
        },
        {
          kind: 'ageup',
          ageUpTo: 2,
          label: 'Feudal landmark',
          targetTimeSec: 300,
          actualTimeSec: null,
          deltaSec: null,
          ok: null,
        },
      ]),
    )

    expect(plan).toEqual([
      expect.objectContaining({
        kind: 'data-gap',
        evidence:
          'Decoded match data could not grade 1 villager checkpoint and 1 landmark checkpoint.',
      }),
    ])
    expect(plan[0]!.advice).toContain('do not treat missing decoded data as a failed step')
  })

  it('does not invent recovery causes for passed, early, or above-plan checkpoints', () => {
    const plan = buildRecoveryPlan(
      report([
        {
          kind: 'ageup',
          ageUpTo: 2,
          label: 'Feudal landmark',
          targetTimeSec: 300,
          actualTimeSec: 220,
          deltaSec: -80,
          ok: false,
        },
        {
          kind: 'villagers',
          label: 'Villagers @ 5:00',
          targetTimeSec: 300,
          targetVillagers: 13,
          actualVillagers: 17,
          villagerDelta: 4,
          ok: false,
        },
      ]),
    )

    expect(plan).toEqual([])
  })
})

describe('liveBuildForkPlan', () => {
  it('uses static team matchup guidance, limits it, and frames it as a scout condition', () => {
    const plan = liveBuildForkPlan({
      reference,
      opponentCivs: ['french', 'mongols'],
    })

    expect(plan.forks).toHaveLength(2)
    expect(plan.forks[0]).toMatchObject({ source: 'static-matchup' })
    expect(plan.forks[0]!.condition).toMatch(/^If you scout .+:$/)
    expect(plan.forks[0]!.advice).toContain('Keep English 2TC as the baseline')
    expect(plan.forks[0]!.condition.split(/ or /)).toHaveLength(2)
    expect(plan.forks[0]!.condition).toContain('Horseman')
    expect(plan.coverageNote).toBeNull()
  })

  it('extracts a conditional response already present in the selected build', () => {
    const plan = liveBuildForkPlan({ reference, opponentCivs: [], maxForks: 2 })
    const fork = plan.forks.find((entry) => entry.source === 'reference-build')

    expect(fork).toEqual({
      source: 'reference-build',
      condition: 'If you scout opponent aggression:',
      advice: 'Build a Barracks and add Spearmen',
    })
  })

  it('is honest when opponent civilization coverage is missing or partial', () => {
    const missing = liveBuildForkPlan({ reference, opponentCivs: [null] })
    expect(missing.coverageNote).toBe(
      'Opponent civilization unavailable — no matchup branch inferred.',
    )
    expect(missing.forks.every((fork) => fork.source !== 'static-matchup')).toBe(true)

    const partial = liveBuildForkPlan({ reference, opponentCivs: ['french', null] })
    expect(partial.coverageNote).toBe(
      '1 opponent civilization unknown — matchup guidance covers known civilizations only.',
    )
  })

  it('deduplicates team civilizations and respects the fork cap', () => {
    const plan = liveBuildForkPlan({
      reference,
      opponentCivs: ['french', 'FRENCH', 'mongols'],
      maxForks: 1,
    })
    expect(plan.forks).toHaveLength(1)
    expect(plan.forks[0]!.source).toBe('static-matchup')
  })
})
