import { HOUR_IN_MS, IS_BROWSER } from 'prepo-constants'

const VALID_PERIOD = 30 * 24 * HOUR_IN_MS // 30 days

const getIsOutdated = (): boolean => {
  if (!IS_BROWSER) return false
  const { hostname } = window.location

  const hostnameLowercase = hostname.toLowerCase()
  // versions on official links are never outdated
  if (
    hostnameLowercase.includes('.ipns.') ||
    hostnameLowercase.includes('prepo.eth') ||
    hostnameLowercase.toLowerCase() === 'app.prepo.io'
  )
    return false

  // only time there won't be a NEXT_PUBLIC_PREPO_BUILD_TIME is when running locally
  const now = new Date().getTime()
  const builtAt = +(process.env.NEXT_PUBLIC_PREPO_BUILD_TIME ?? now)

  // version is outdated if older than valid period since build time
  return now > builtAt + VALID_PERIOD
}

const isOutdated = getIsOutdated()

export default isOutdated
