const BANNED_REGIONS = ['Cuba', 'Iran', 'Korea (North)', 'Russia', 'Syria', 'Venezuela']

async function buildTimeZoneToCountryMapping(): Promise<Record<string, string | undefined>> {
  const {
    countries,
    zones,
  }: {
    countries: Record<string, { name: string }>
    zones: Record<string, { countries: string[] }>
  } = await import('moment-timezone/data/meta/latest.json')

  return Object.entries(zones).reduce(
    (acc, [zoneName, { countries: zoneCountries }]) => ({
      ...acc,
      [zoneName]: countries[zoneCountries[0]].name,
    }),
    {}
  )
}

async function getUserRegion(): Promise<string | undefined> {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
  const timeZoneToCountry = await buildTimeZoneToCountryMapping()
  return timeZoneToCountry[timeZone]
}

export async function isUserInBannedRegion(): Promise<boolean> {
  return BANNED_REGIONS.includes((await getUserRegion()) ?? '')
}
