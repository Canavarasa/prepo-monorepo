import { Brand } from 'utility-types'

/*
 * DateTimes represent a moment in time in UTC. (i.e. July 30th, 2015 at 03:26:13 PM)
 */

export type DateTimeInMs = Brand<number, 'DateTimeInMs'>

/*
 * Durations represent a period of time (i.e. 2 hours and 4 minutes)
 */

export type DurationInMs = Brand<number, 'DurationInMs'>
