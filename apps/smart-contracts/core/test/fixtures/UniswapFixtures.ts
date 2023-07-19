import { FakeContract, smock } from '@defi-wonderland/smock'
import { abi as SWAP_ROUTER_ABI } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { SwapRouter } from '../../types/generated'

export function fakeSwapRouterFixture(): Promise<FakeContract<SwapRouter>> {
  return smock.fake<SwapRouter>(SWAP_ROUTER_ABI)
}
