import { ContractReturn, DynamicContractStore } from 'prepo-stores'
import { BigNumber } from 'ethers'
import { RootStore } from './RootStore'
import { DepositRecordAbi, DepositRecordAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'
import { BalanceLimitStatus, DepositLimitStatusHolder } from '../utils/balance-limits'

type GetGlobalNetDepositAmount = DepositRecordAbi['functions']['getGlobalNetDepositAmount']
type GetGlobalNetDepositCap = DepositRecordAbi['functions']['getGlobalNetDepositCap']
type GetUserDepositAmount = DepositRecordAbi['functions']['getUserDepositAmount']
type GetUserDepositCap = DepositRecordAbi['functions']['getUserDepositCap']

export class DepositRecordStore
  extends DynamicContractStore<RootStore, SupportedContracts>
  implements DepositLimitStatusHolder
{
  constructor(rootStore: RootStore) {
    super(
      rootStore,
      () => rootStore.collateralStore.depositHook.depositRecord,
      DepositRecordAbi__factory
    )
  }

  private getGlobalNetDepositAmount(
    ...params: Parameters<GetGlobalNetDepositAmount>
  ): ContractReturn<GetGlobalNetDepositAmount> {
    return this.call<GetGlobalNetDepositAmount>('getGlobalNetDepositAmount', params)
  }

  private getGlobalNetDepositCap(
    ...params: Parameters<GetGlobalNetDepositCap>
  ): ContractReturn<GetGlobalNetDepositCap> {
    return this.call<GetGlobalNetDepositCap>('getGlobalNetDepositCap', params)
  }

  private getUserDepositAmount(
    ...params: Parameters<GetUserDepositAmount>
  ): ContractReturn<GetUserDepositAmount> {
    return this.call<GetUserDepositAmount>('getUserDepositAmount', params)
  }

  private getUserDepositCap(
    ...params: Parameters<GetUserDepositCap>
  ): ContractReturn<GetUserDepositCap> {
    return this.call<GetUserDepositCap>('getUserDepositCap', params)
  }

  private get globalNetDepositAmountInWstEth(): BigNumber | undefined {
    return this.getGlobalNetDepositAmount()?.[0]
  }

  get globalNetDepositAmountInEth(): BigNumber | undefined {
    const { globalNetDepositAmountInWstEth } = this
    if (globalNetDepositAmountInWstEth === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(globalNetDepositAmountInWstEth)
  }

  private get globalNetDepositCapInWstEth(): BigNumber | undefined {
    return this.getGlobalNetDepositCap()?.[0]
  }

  get globalNetDepositCapInEth(): BigNumber | undefined {
    const { globalNetDepositCapInWstEth } = this
    if (globalNetDepositCapInWstEth === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(globalNetDepositCapInWstEth)
  }

  private get userDepositAmountOfSignerInWstEth(): BigNumber | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    return this.getUserDepositAmount(address)?.[0]
  }

  get userDepositAmountOfSignerInEth(): BigNumber | undefined {
    const { userDepositAmountOfSignerInWstEth } = this
    if (userDepositAmountOfSignerInWstEth === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(userDepositAmountOfSignerInWstEth)
  }

  private get userDepositCapInWstEth(): BigNumber | undefined {
    return this.getUserDepositCap()?.[0]
  }

  get userDepositCapInEth(): BigNumber | undefined {
    const { userDepositCapInWstEth } = this
    if (userDepositCapInWstEth === undefined) return undefined
    return this.root.balancerStore.getWstEthAmountInEth(userDepositCapInWstEth)
  }

  get globalLimit(): BalanceLimitStatus {
    return {
      capEth: this.globalNetDepositCapInEth,
      currentAmountEth: this.globalNetDepositAmountInEth,
    }
  }

  get userLimit(): BalanceLimitStatus {
    return {
      capEth: this.userDepositCapInEth,
      currentAmountEth: this.userDepositAmountOfSignerInEth,
    }
  }
}
