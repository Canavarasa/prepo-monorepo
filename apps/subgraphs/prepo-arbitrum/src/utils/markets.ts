import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import { LongShortToken, Market } from '../generated/types/schema'

export function createMarket(
  marketAddress: string,
  longTokenAddress: string,
  shortTokenAddress: string,
  collateralTokenAddress: string,
  floorLongPayout: BigInt,
  ceilingLongPayout: BigInt,
  floorValuation: BigInt,
  ceilingValuation: BigInt,
  expiryTime: BigInt,
  event: ethereum.Event
): Market {
  const market = new Market(marketAddress)
  market.longToken = longTokenAddress
  market.shortToken = shortTokenAddress
  market.collateralToken = collateralTokenAddress

  market.floorLongPayout = floorLongPayout
  market.ceilingLongPayout = ceilingLongPayout

  market.floorValuation = floorValuation
  market.ceilingValuation = ceilingValuation

  market.expiryTime = expiryTime
  market.createdAtTimestamp = event.block.timestamp
  market.createdAtBlockNumber = event.block.number

  // create entity for long tokens
  const longToken = new LongShortToken(longTokenAddress)
  longToken.market = marketAddress
  longToken.save()

  // create entity for short tokens
  const shortToken = new LongShortToken(shortTokenAddress)
  shortToken.market = marketAddress
  shortToken.save()

  market.save()

  return market
}
