import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { CreateMarketResult, StandaloneCreateMarketParams } from '../../types'
import { PrePOMarket, PrePOMarket__factory } from '../../types/generated'

export async function prePOMarketFixture(
  marketParams: StandaloneCreateMarketParams
): Promise<PrePOMarket> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prePOMarket: any = await ethers.getContractFactory('PrePOMarket')
  return (await prePOMarket
    .connect(marketParams.deployer)
    .deploy(
      marketParams.deployer.address,
      marketParams.longToken,
      marketParams.shortToken,
      marketParams.addressBeacon,
      marketParams.uintBeacon,
      marketParams.parameters
    )) as PrePOMarket
}

export async function smockPrePOMarketFixture(
  marketParams: StandaloneCreateMarketParams
): Promise<MockContract<PrePOMarket>> {
  const mockFactory = await smock.mock<PrePOMarket__factory>('PrePOMarket')
  return mockFactory
    .connect(marketParams.deployer)
    .deploy(
      marketParams.deployer.address,
      marketParams.longToken,
      marketParams.shortToken,
      marketParams.addressBeacon,
      marketParams.uintBeacon,
      marketParams.parameters
    )
}

export async function prePOMarketAttachFixture(
  market: string | CreateMarketResult
): Promise<PrePOMarket> {
  const marketAddress: string = typeof market !== 'string' ? market.market : market
  const factory = await ethers.getContractFactory('PrePOMarket')
  return factory.attach(marketAddress) as PrePOMarket
}

export function fakePrePOMarketFixture(): Promise<FakeContract<PrePOMarket>> {
  return smock.fake<PrePOMarket>('PrePOMarket')
}
