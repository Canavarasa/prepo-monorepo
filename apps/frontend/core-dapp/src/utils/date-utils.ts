import { MIN_IN_MS, SEC_IN_MS, HOUR_IN_MS } from 'prepo-constants'
import endOfHour from 'date-fns/endOfHour'
import endOfDay from 'date-fns/endOfDay'
import format from 'date-fns/format'
import startOfDay from 'date-fns/startOfDay'
import startOfHour from 'date-fns/startOfHour'
import { DateTimeInMs, DurationInMs } from './date-types'
import { DateRange } from '../types/general.types'

const DATE_FORMAT = 'do LLLL yyyy' // 1st January 2025
const DATE_FORMAT_SHORTEN_MONTH = 'LLL d yyyy' // Jan 1 2025
const DATE_TIME_FORMAT = 'd LLL HH:mm' // 1 Jan 23:12
const DATE_TIME_FORMAT_PRECISE = "d LLLL yyyy hh:mm 'UTC'x" // 1 January 2025 00:00 UTC+2
const TIME_FORMAT_12 = 'h:mma'

export const getEndOfDay = (ms: number): number => endOfDay(ms).getTime()
export const getStartOfDay = (ms: number): number => startOfDay(ms).getTime()
export const getStartOfHour = (ms: number): number => startOfHour(ms).getTime()
export const getDateAndLiteralMonthFromMs = (ms: number): string => format(ms, 'dd MMM')
export const getHourMinsFromMs = (ms: number): string => format(ms, 'HH:mm')
export const getEndOfHour = (ms: number): number => endOfHour(ms).getTime()
export const formatDateTimePrecise = (ms: DateTimeInMs): string =>
  format(ms, DATE_TIME_FORMAT_PRECISE)

export const getUTCEndOfDay = (ms: number): number => {
  const localEndOfDay = getEndOfDay(ms)
  const offsetMins = new Date(localEndOfDay).getTimezoneOffset()
  return localEndOfDay - offsetMins * MIN_IN_MS
}

export const getUTCStartOfDay = (ms: number): number => {
  const localStartOfDay = getStartOfDay(ms)
  const offsetMins = new Date(localStartOfDay).getTimezoneOffset()
  return localStartOfDay - offsetMins * MIN_IN_MS
}

export const getFullDateFromMs = (ms: number): string => format(ms, DATE_FORMAT)

export const getFullDateShortenMonthFromMs = (ms: DateTimeInMs): string =>
  format(ms, DATE_FORMAT_SHORTEN_MONTH)

export const getDateTimeFromSeconds = (ms: number): string =>
  format(ms * SEC_IN_MS, DATE_TIME_FORMAT)

export const getFullStringFromMs = (
  ms: number,
  { date = DATE_FORMAT, time = TIME_FORMAT_12 }: { date?: string; time?: string } = {}
): string => format(ms, `${date}, ${time}`)

export const getHoursByMiliseconds = (miliseconds: number): number =>
  Math.floor(miliseconds / 1000 / 60 / 60)

export const getMilisecondsByHours = (hours: number): number => hours * 60 * 60 * 1000

export const getDateRangeFromHours = (hours: number, fromMiliseconds?: number): DateRange => {
  const endTimeInMs = fromMiliseconds ?? new Date().getTime()
  const startTimeInMs = endTimeInMs - getMilisecondsByHours(hours)
  return { endTimeInMs, startTimeInMs }
}

export const getDateRangeFromDays = (days: number, fromMiliseconds?: number): DateRange => {
  const endTimeInMs = fromMiliseconds ?? new Date().getTime()
  const startTimeInMs = endTimeInMs - getMilisecondsByHours(days * 24)
  return { endTimeInMs, startTimeInMs }
}

export const getHoursFromDateRange = ({ endTimeInMs, startTimeInMs }: DateRange): number =>
  getHoursByMiliseconds(endTimeInMs - startTimeInMs)

export const getDaysFromDateRange = (dateRange: DateRange): number =>
  Math.ceil(getHoursFromDateRange(dateRange) / 24)

export const addDuration = (dateTime: DateTimeInMs, duration: DurationInMs): DateTimeInMs =>
  (dateTime + duration) as DateTimeInMs

export const formatDuration = (durationInMs: DurationInMs): string => {
  if (durationInMs <= 0) {
    return '0s'
  }

  const hours = Math.floor(durationInMs / HOUR_IN_MS)
  const minutes = Math.floor((durationInMs / MIN_IN_MS) % 60)
  const seconds = Math.floor((durationInMs / SEC_IN_MS) % 60)

  const hoursString = hours > 0 ? `${hours}h` : ''
  const minutesString = hours > 0 || minutes > 0 ? `${minutes}m` : ''
  const secondsString = `${seconds}s`

  return `${hoursString} ${minutesString} ${secondsString}`.trim()
}
