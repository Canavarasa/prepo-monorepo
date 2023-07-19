import { Address } from '@graphprotocol/graph-ts'
import { MarketCreation } from '../generated/types/PrePOMarketFactory/PrePOMarketFactory'
import { TokenType, fetchCollateralToken, fetchERC20 } from '../utils/ERC20'
import { PrePOMarket as PrePOMarketTemplate } from '../generated/types/templates'
import { PRE_WSTETH_ADDRESS } from '../utils/constants'
import { createMarket } from '../utils/markets'

export function handleMarketCreation(event: MarketCreation): void {
  const longERC20 = fetchERC20(event.params.longToken, TokenType.longShort)
  const shortERC20 = fetchERC20(event.params.shortToken, TokenType.longShort)
  const collateralToken = fetchCollateralToken(Address.fromString(PRE_WSTETH_ADDRESS))

  // invalid tokens, unlikely to happen
  if (!longERC20 || !shortERC20 || !collateralToken) return

  createMarket(
    event.params.market.toHexString(),
    longERC20.id,
    shortERC20.id,
    collateralToken.id,
    event.params.floorLongPayout,
    event.params.ceilingLongPayout,
    event.params.floorValuation,
    event.params.ceilingValuation,
    event.params.expiryTime,
    event
  )

  PrePOMarketTemplate.create(event.params.market)
}
