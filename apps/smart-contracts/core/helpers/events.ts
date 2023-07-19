import { MockContract } from '@defi-wonderland/smock'
import {
  ERC20,
  NonfungiblePositionManager,
  PrePOMarket,
  PrePOMarketFactory,
} from '../types/generated'
import { MarketCreationEvent } from '../types/generated/artifacts/contracts/PrePOMarketFactory'
import { TransferEvent } from '../types/generated/artifacts/@openzeppelin/contracts/token/ERC20/ERC20'
import { IncreaseLiquidityEvent } from '../types/generated/externalArtifacts/INonfungiblePositionManager'

export async function findMarketCreationEvent(
  factory: PrePOMarketFactory | MockContract<PrePOMarket>,
  startBlock = 'latest',
  endBlock = 'latest'
): Promise<MarketCreationEvent[]> {
  const filter = factory.filters.MarketCreation()
  const events = await factory.queryFilter(filter, startBlock, endBlock)
  return events as MarketCreationEvent[]
}

export async function findTransferEvent(
  erc20: ERC20 | MockContract<ERC20>,
  source: string,
  destination: string,
  startBlock = 'latest',
  endBlock = 'latest'
): Promise<TransferEvent[]> {
  const filter = erc20.filters.Transfer(source, destination)
  const events = await erc20.queryFilter(filter, startBlock, endBlock)
  return events as TransferEvent[]
}

export function findIncreaseLiquidityEvent(
  positionManager: NonfungiblePositionManager,
  tokenId?: number,
  startBlock = 'latest',
  endBlock = 'latest'
): Promise<IncreaseLiquidityEvent[]> {
  const filter = positionManager.filters.IncreaseLiquidity(tokenId)
  return positionManager.queryFilter(filter, startBlock, endBlock)
}
