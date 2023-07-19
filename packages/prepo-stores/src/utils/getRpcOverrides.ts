import { parse } from 'query-string'
import fromPairs from 'lodash/fromPairs'

/*
 * Only load trusted RPCs via URL. Otherwise, a user may be referred to prePO
 * via a link containing a malicious URL.
 */
const isRpcAllowed = (rpcUrl: string): boolean => new URL(rpcUrl).host === 'rpc.vnet.tenderly.co'

export const getRpcOverrides = (): Record<number, string | undefined> => {
  if (typeof window === 'undefined') return {}

  const query = parse(window.location.search)

  let rawRpcs: string[] = []

  if (typeof query.rpc === 'string') {
    rawRpcs = [query.rpc]
  } else if (Array.isArray(query.rpc)) {
    rawRpcs = query.rpc.filter((str): str is string => typeof str === 'string')
  }

  return fromPairs(
    rawRpcs
      .map((rawRpc) => {
        const [chainId, ...urlParts] = rawRpc.split(':')
        const url = urlParts.join(':')

        if (Number.isNaN(+chainId) || !url || !isRpcAllowed(url)) return undefined

        return [+chainId, url]
      })
      .filter((pair): pair is NonNullable<typeof pair> => !!pair)
  )
}
