/* eslint-disable max-classes-per-file */
import { Network } from 'prepo-constants'
import { getRpcOverrides } from './getRpcOverrides'
import {
  FallthroughProvider,
  StaticJsonRpcBatchProvider,
  TenderlyRpcProvider,
} from './CustomProviders'

export const createFallthroughProvider = (network: Network): FallthroughProvider => {
  const { rpcUrls } = network

  const rpcOverride = getRpcOverrides()[network.chainId]

  /**
   * If we're using Tenderly, instantiate a Tenderly provider instead of a
   * Fallback provider. The differences are:
   *
   * 1. The Tenderly provider doesn't fall back to the default RPC if the
   *    requests fail. We don't want to hit the default RPC in tests.
   *
   * 2. The Tenderly provider auto retries requests if they fail. This is
   *    because it can be unreliable sometimes.
   *
   * 3. The Tenderly provider doesn't batch requests because it doesn't support
   *    batches well.
   */
  if (rpcOverride?.startsWith('https://rpc.vnet.tenderly.co')) {
    const tenderlyRpcProvider = new TenderlyRpcProvider(rpcOverride, network.chainId)
    return new FallthroughProvider([tenderlyRpcProvider], network.chainId, {
      excludeWalletProvider: true,
    })
  }

  const providers = [rpcOverride, ...rpcUrls]
    .filter((url): url is string => url !== undefined)
    .map((rpcUrl) => new StaticJsonRpcBatchProvider(rpcUrl, network.chainId))

  return new FallthroughProvider(providers, network.chainId)
}
