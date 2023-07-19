// eslint-disable-next-line max-classes-per-file
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { makeObservable, observable, reaction, runInAction } from 'mobx'
import { ContractReturn, ContractStore } from 'prepo-stores'
import { RootStore } from './RootStore'
import { SupportedContracts } from '../lib/contract.types'
import { MetaStablePoolAbi, MetaStablePoolAbi__factory } from '../../generated/typechain'
import { MetaStablePoolTokenProps } from '../utils/balancer-math'

type GetAmplificationParameter = MetaStablePoolAbi['functions']['getAmplificationParameter']
type GetPoolId = MetaStablePoolAbi['functions']['getPoolId']
type GetPriceRateCache = MetaStablePoolAbi['functions']['getPriceRateCache']
type GetSwapFeePercentage = MetaStablePoolAbi['functions']['getSwapFeePercentage']

class MetaStablePoolToken {
  constructor(
    private metaStablePool: MetaStablePool,
    public tokenAddress: string,
    public index: number
  ) {}

  get priceRate(): BigNumber | undefined {
    return this.metaStablePool.getPriceRateCache(this.tokenAddress)?.[0]
  }

  get balance(): BigNumber | undefined {
    if (this.metaStablePool.poolTokens === undefined) return undefined
    return this.metaStablePool.poolTokens.balances[this.index]
  }
}

export class MetaStablePool extends ContractStore<RootStore, SupportedContracts> {
  tokens?: MetaStablePoolToken[] = undefined
  constructor(root: RootStore) {
    super(root, 'WSTETH_WETH_BALANCER_POOL', MetaStablePoolAbi__factory)
    this.initTokens()
    makeObservable(this, { tokens: observable })
  }

  initTokens(): void {
    const cleanup = reaction(
      () => this.poolTokens,
      (poolTokens) => {
        if (poolTokens === undefined) return
        const tokens = poolTokens.tokens.map(
          (address, index) => new MetaStablePoolToken(this, address, index)
        )
        runInAction(() => {
          this.tokens = tokens
          cleanup()
        })
      }
    )
  }

  private getAmplificationParameter(
    ...params: Parameters<GetAmplificationParameter>
  ): ContractReturn<GetAmplificationParameter> {
    return this.call<GetAmplificationParameter>('getAmplificationParameter', params)
  }

  private getPoolId(...params: Parameters<GetPoolId>): ContractReturn<GetPoolId> {
    return this.call<GetPoolId>('getPoolId', params)
  }

  getPriceRateCache(...params: Parameters<GetPriceRateCache>): ContractReturn<GetPriceRateCache> {
    return this.call<GetPriceRateCache>('getPriceRateCache', params)
  }

  private getSwapFeePercentage(
    ...params: Parameters<GetSwapFeePercentage>
  ): ContractReturn<GetSwapFeePercentage> {
    return this.call<GetSwapFeePercentage>('getSwapFeePercentage', params)
  }

  get amplificationParameter():
    | { value: BigNumber; isUpdating: boolean; precision: BigNumber }
    | undefined {
    const output = this.getAmplificationParameter()
    if (output === undefined) return undefined
    return {
      value: output[0],
      isUpdating: output[1],
      precision: output[2],
    }
  }

  get swapFeePercentage(): BigNumber | undefined {
    return this.getSwapFeePercentage()?.[0]
  }

  get poolId(): string | undefined {
    return this.getPoolId()?.[0]
  }

  get poolTokens():
    | { tokens: string[]; balances: BigNumber[]; lastChangeBlock: BigNumber }
    | undefined {
    if (this.poolId === undefined) return undefined
    const output = this.root.balancerVaultStore.getPoolTokens(this.poolId)
    if (output === undefined) return undefined
    return {
      tokens: output[0],
      balances: output[1],
      lastChangeBlock: output[2],
    }
  }

  // Balancer's calculation is based on data from their subgraph, which converts token with 0 price rate to 1
  // and then apply the price rate to token balance in the reference below
  // ref: https://github.com/balancer/balancer-sor/blob/9059705624d9be5b20ed00e9cee4cffceca43044/src/pools/metaStablePool/metaStablePool.ts#L123
  get allTokens(): MetaStablePoolTokenProps[] | undefined {
    if (this.tokens === undefined) return undefined

    const tokens: MetaStablePoolTokenProps[] = []

    for (const token of this.tokens) {
      if (token.balance === undefined || token.priceRate === undefined) return undefined
      const priceRate = token.priceRate.eq(0) ? parseEther('1') : token.priceRate
      const balance = token.balance.mul(priceRate).div(parseEther('1'))
      tokens.push({ balance, priceRate })
    }

    return tokens
  }
}
