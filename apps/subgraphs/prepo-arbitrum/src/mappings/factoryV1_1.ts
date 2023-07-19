import { MarketCreation } from '../generated/types/PrePOMarketFactoryV1_1/PrePOMarketFactoryV1_1'
import { TokenType, fetchCollateralToken, fetchERC20 } from '../utils/ERC20'
import { PrePOMarket as PrePOMarketTemplate } from '../generated/types/templates'
import { createMarket } from '../utils/markets'

export function handleMarketCreation(event: MarketCreation): void {
  const longERC20 = fetchERC20(event.params.longToken, TokenType.longShort)
  const shortERC20 = fetchERC20(event.params.shortToken, TokenType.longShort)
  const collateralToken = fetchCollateralToken(event.params.parameters.collateral)

  // invalid tokens, unlikely to happen
  if (!longERC20 || !shortERC20 || !collateralToken) return

  createMarket(
    event.params.market.toHexString(),
    longERC20.id,
    shortERC20.id,
    collateralToken.id,
    event.params.parameters.floorLongPayout,
    event.params.parameters.ceilingLongPayout,
    event.params.parameters.floorValuation,
    event.params.parameters.ceilingValuation,
    event.params.parameters.expiryTime,
    event
  )

  PrePOMarketTemplate.create(event.params.market)
}
