import { makeObservable, observable } from 'mobx'
import { ContractReturn, Factory } from 'prepo-stores'
import { RootStore } from './RootStore'
import { EthConvertible } from './BalancerStore'
import { Erc20PermitStore } from './entities/Erc20Permit.entity'
import { DepositHookStore } from './DepositHookStore'
import { WithdrawHookStore } from './WithdrawHookStore'
import { CollateralAbi, CollateralAbi__factory } from '../../generated/typechain'

type GetDepositHook = CollateralAbi['functions']['getDepositHook']
type GetWithdrawHook = CollateralAbi['functions']['getWithdrawHook']

const TOKEN_SYMBOL = 'preETH'

export class CollateralStore extends Erc20PermitStore {
  depositHook = new DepositHookStore(this.root, () => this.getDepositHook()?.[0])
  withdrawHook = new WithdrawHookStore(this.root, () => this.getWithdrawHook()?.[0])

  constructor(root: RootStore) {
    super({
      root,
      tokenName: 'COLLATERAL',
      factory: CollateralAbi__factory as unknown as Factory,
    })
    this.symbolOverride = TOKEN_SYMBOL

    makeObservable<CollateralStore, 'getDepositHook' | 'getWithdrawHook'>(this, {
      getDepositHook: observable,
      getWithdrawHook: observable,
    })
  }

  private getDepositHook(...params: Parameters<GetDepositHook>): ContractReturn<GetDepositHook> {
    return this.call<GetDepositHook>('getDepositHook', params)
  }

  private getWithdrawHook(...params: Parameters<GetWithdrawHook>): ContractReturn<GetWithdrawHook> {
    return this.call<GetWithdrawHook>('getWithdrawHook', params)
  }

  get depositsAllowed(): boolean | undefined {
    return this.depositHook.depositsAllowed
  }

  get balance(): EthConvertible | undefined {
    if (this.balanceOfSigner === undefined) return undefined
    return this.root.balancerStore.getConvertibleFromWstEth(this.balanceOfSigner)
  }
}
