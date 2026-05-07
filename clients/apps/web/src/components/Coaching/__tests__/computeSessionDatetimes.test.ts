import { describe, expect, it } from 'vitest'
import {
  computeSessionDatetimes,
  type ScheduleState,
} from '../CoachingWizard.steps'

const baseSchedule: ScheduleState = {
  startDate: '2026-06-03', // Wednesday
  dayOfWeek: 3, // Wed
  time: '18:00',
  durationMinutes: 60,
  timezone: 'UTC',
}

describe('computeSessionDatetimes', () => {
  it('emits exactly N sessions one week apart', () => {
    const out = computeSessionDatetimes(baseSchedule, 8)
    expect(out).toHaveLength(8)
    for (let i = 1; i < out.length; i++) {
      const gap =
        new Date(out[i]!).getTime() - new Date(out[i - 1]!).getTime()
      expect(gap).toBe(7 * 24 * 3600 * 1000)
    }
  })

  it('respects time-of-day on the first session', () => {
    const at = new Date(computeSessionDatetimes(baseSchedule, 1)[0]!)
    // The schedule was authored as 18:00 LOCAL — the local hour is what
    // matters; UTC offset depends on the test runner's timezone.
    expect(at.getHours()).toBe(18)
    expect(at.getMinutes()).toBe(0)
  })

  it('advances startDate to the next matching dayOfWeek', () => {
    const schedule: ScheduleState = {
      ...baseSchedule,
      startDate: '2026-06-04', // Thursday
      dayOfWeek: 1, // Monday — first matching day is Mon Jun 8
    }
    const at = new Date(computeSessionDatetimes(schedule, 1)[0]!)
    expect(at.getDay()).toBe(1)
    expect(at.toISOString().slice(0, 10)).toBe('2026-06-08')
  })

  it('returns an empty list for zero weeks', () => {
    expect(computeSessionDatetimes(baseSchedule, 0)).toEqual([])
  })

  it('handles 26-week max', () => {
    expect(computeSessionDatetimes(baseSchedule, 26)).toHaveLength(26)
  })
})
