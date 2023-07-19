import { makeAutoObservable } from 'mobx'
import { IconName } from 'prepo-ui'
import { BigNumber } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { RootStore } from './RootStore'
import { Erc20Store } from './entities/Erc20.entity'
import { CollateralStore } from './CollateralStore'

type EthToken = {
  type: 'native'
  iconName: 'eth'
  name: string
  shortName?: string
}

type PreWstEthToken = {
  type: 'preWstEth'
  iconName: 'preeth'
  name: 'prePO Balance'
  shortName: 'preETH'
  erc20: CollateralStore
}

type Erc20Token = {
  type: 'erc20'
  iconName: IconName
  name: string
  shortName?: string
  erc20: Erc20Store
}

export type Token = EthToken | Erc20Token | PreWstEthToken

// strategy for instantiating ERC20Store from any arbitrary address:
// - write a function that when given an address, check that the address has `balanceOf` and some important ERC20 values (e.g. decimals)
// - if valid, instantiate an ERC20Store with that address and push into a list of tokens
// - (could be depositTokens or tradeTokens, or even a list shared between deposit/trade tokens)
// - we could even save those validated addresses into localStorage so the next time user come back
// - their favourite token will show in the list by default
export class TokensStore {
  static NATIVE_ETH = {
    type: 'native',
    iconName: 'eth',
    name: 'ETH',
    shortName: 'ETH',
  } as const
  readonly COLLATERAL = {
    type: 'preWstEth',
    iconName: 'preeth',
    name: 'prePO Balance',
    shortName: 'preETH',
    erc20: this.root.collateralStore,
  } as const

  tradeTokens: Token[]
  depositTokens: Token[]
  constructor(private root: RootStore) {
    this.tradeTokens = [TokensStore.NATIVE_ETH, this.COLLATERAL]
    this.depositTokens = [
      TokensStore.NATIVE_ETH,
      {
        type: 'erc20',
        iconName: 'weth',
        name: 'Wrapped ETH',
        shortName: 'WETH',
        erc20: this.root.baseTokenStore,
      },
    ]
    makeAutoObservable(this)
  }

  /** Returns user's token balance in ETH */
  getTokenBalanceBN(token: Token): BigNumber | undefined {
    if (token.type === 'native') return this.root.web3Store.signerState.balance

    if (token.type === 'preWstEth') return token.erc20.balance?.inEthBN

    return token.erc20.balanceOfSigner
  }

  /** Returns user's token balance in ETH */
  getTokenBalance(token: Token): string | undefined {
    if (token.type === 'native') {
      if (this.root.web3Store.signerState.balance === undefined) return undefined
      return formatEther(this.root.web3Store.signerState.balance)
    }

    if (token.type === 'preWstEth') return token.erc20.balance?.inEthString

    return token.erc20.tokenBalanceFormat
  }

  static parseUnits(token: Token, amount: string | undefined): BigNumber | undefined {
    if (amount === undefined) return undefined

    if (token.type === 'native') {
      return parseEther(amount)
    }

    return token.erc20.parseUnits(amount)
  }

  get sortedTradeTokens(): Token[] {
    return this.tradeTokens.slice().sort((a, b) => {
      const aBalance = this.getTokenBalance(a)
      const bBalance = this.getTokenBalance(b)
      if (aBalance === undefined || bBalance === undefined) return 0
      return +bBalance - +aBalance
    })
  }
}
