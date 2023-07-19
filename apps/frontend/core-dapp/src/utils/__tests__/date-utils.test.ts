import { formatDuration, getFullDateFromMs, getFullStringFromMs } from '../date-utils'
import { DurationInMs } from '../date-types'

const validUTCMorningTimestamp = 1635143228000
const validUTCNightTimestamp = 1633198815000
const expectedValidUTCMorning = '25th October 2021, 6:27AM'
const expectedValidUTCNight = '2nd October 2021, 6:20PM'

describe('getFullDateFromMs tests', () => {
  it('should return date string given valid timestamp', () => {
    const date = getFullDateFromMs(validUTCMorningTimestamp)
    expect(date).toBe(expectedValidUTCMorning.split(',')[0])
  })
})

describe('getFullStringFromMs tests', () => {
  it('should return time string given valid timestamp', () => {
    const date = getFullStringFromMs(validUTCMorningTimestamp)
    expect(date).toBe(expectedValidUTCMorning)
  })

  it('should return time string in PM given valid night timestamp', () => {
    const date = getFullStringFromMs(validUTCNightTimestamp)
    expect(date).toBe(expectedValidUTCNight)
  })
})

describe('formatDuration tests', () => {
  it('should format duration in milliseconds with hours, minutes, and seconds', () => {
    expect(formatDuration(123456789 as DurationInMs)).toBe('34h 17m 36s')
    expect(formatDuration(3600000 as DurationInMs)).toBe('1h 0m 0s')
    expect(formatDuration(900000 as DurationInMs)).toBe('15m 0s')
    expect(formatDuration(60000 as DurationInMs)).toBe('1m 0s')
    expect(formatDuration(1000 as DurationInMs)).toBe('1s')
  })

  it('should consider zero durations as zero', () => {
    expect(formatDuration(0 as DurationInMs)).toBe('0s')
  })

  it('should consider negative durations as zero', () => {
    expect(formatDuration(-1000 as DurationInMs)).toBe('0s')
  })
})
