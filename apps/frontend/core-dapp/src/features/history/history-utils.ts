import { SupportedNetworks } from 'prepo-constants'
import { IconName } from 'prepo-ui'
import { getContractAddress } from 'prepo-utils'
import { FilterType } from '../../components/Filter/filter.constants'
import { markets } from '../../lib/markets'
import { supportedMarketTokens } from '../../lib/markets-tokens-contracts'
import { Market } from '../../types/market.types'
import { Direction } from '../trade/TradeStore'
import { supportedMarkets } from '../../lib/markets-contracts'

export const ACTION_NAME = {
  OPEN: 'Opened',
  CLOSE: 'Closed',
  REDEEM: 'Closed',
  DEPOSIT: 'Deposited',
  WITHDRAW: 'Withdrawn',
}

export const KNOWN_HISTORY_EVENTS: { [key: string]: FilterType } = {
  WITHDRAW: FilterType.Withdrawn,
  DEPOSIT: FilterType.Deposited,
  OPEN: FilterType.Opened,
  CLOSE: FilterType.Closed,
  REDEEM: FilterType.Redeemed,
}

export const KNOWN_HISTORY_EVENTS_MAP: { [key: string]: string } = Object.entries(
  KNOWN_HISTORY_EVENTS
).reduce((obj, [key, value]) => {
  // eslint-disable-next-line no-param-reassign
  obj[value] = key
  return obj
}, {} as { [key: string]: string })

type TransactionMetadata = {
  name: string
  iconName: IconName
  market?: Market
  direction?: Direction
}

export const getTransactionMetadata = (
  action: string,
  networkName: SupportedNetworks,
  tokenAddress: string,
  contractAddress: string
): TransactionMetadata | undefined => {
  switch (action) {
    case 'DEPOSIT':
    case 'WITHDRAW':
      return { name: 'ETH', iconName: 'eth' }
    case 'REDEEM': {
      const market = markets.find(
        ({ address }) =>
          getContractAddress(address, networkName, supportedMarkets)?.toLowerCase() ===
          contractAddress.toLowerCase()
      )
      if (!market) return undefined
      return {
        name: market.name,
        iconName: market.iconName,
        market,
      }
    }
    default: {
      // compare the transaction's tokenAddress to list of markets on the FE
      // to find the right market's metadata to display on UI
      for (let i = 0; i < markets.length; i++) {
        const { long, short } = markets[i]
        const longTokenAddress =
          supportedMarketTokens[long.tokenAddress]?.[networkName]?.toLowerCase()
        const shortTokenAddress =
          supportedMarketTokens[short.tokenAddress]?.[networkName]?.toLowerCase()

        if (longTokenAddress === tokenAddress) {
          return {
            name: markets[i].name,
            iconName: markets[i].iconName,
            market: markets[i],
            direction: 'long',
          }
        }
        if (shortTokenAddress === tokenAddress) {
          return {
            name: markets[i].name,
            iconName: markets[i].iconName,
            market: markets[i],
            direction: 'short',
          }
        }
      }

      return undefined
    }
  }
}
