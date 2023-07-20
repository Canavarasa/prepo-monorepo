import { makeObservable, observable, computed, action } from 'mobx'
import { BigNumber, utils } from 'ethers'
import { UNLIMITED_AMOUNT_APPROVAL } from 'prepo-constants'
import { getContractAddress, parseUnits } from 'prepo-utils'
import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { RootStore } from '../RootStore'
import { SupportedContracts, SupportedContractsNames } from '../../lib/contract.types'
import { Erc20Abi, Erc20Abi__factory } from '../../../generated/typechain'
import { supportedContracts } from '../../lib/supported-contracts'
import { UnsignedTxOutput } from '../../types/transaction.types'

type TokenSymbol = Erc20Abi['functions']['symbol']
type BalanceOf = Erc20Abi['functions']['balanceOf']
type Decimals = Erc20Abi['functions']['decimals']
type Allowance = Erc20Abi['functions']['allowance']

type Constructor = {
  root: RootStore
  tokenName: SupportedContractsNames
  symbolOverride?: string
  factory?: Factory
}

export class Erc20Store extends ContractStore<RootStore, SupportedContracts> {
  checkingForAllowance = true
  symbolOverride?: string
  transferHash: string | undefined
  transferring = false

  constructor({ root, tokenName, symbolOverride, factory }: Constructor) {
    super(root, tokenName, factory ?? (Erc20Abi__factory as unknown as Factory))
    if (symbolOverride) this.symbolOverride = symbolOverride
    makeObservable(this, {
      allowance: observable,
      balanceOf: observable,
      balanceOfSigner: computed,
      checkingForAllowance: observable,
      decimals: observable,
      decimalsNumber: computed,
      needsToAllowTokens: observable,
      signerAllowance: observable,
      signerNeedsMoreTokens: observable,
      symbol: observable,
      transferHash: observable,
      transferring: observable,
      createUnlockPermanentlyTx: action.bound,
      formatUnits: observable,
      parseUnits: observable,
    })
  }

  // contract read methods

  allowance(...params: Parameters<Allowance>): ContractReturn<Allowance> {
    return this.call<Allowance>('allowance', params)
  }

  balanceOf(...params: Parameters<BalanceOf>): ContractReturn<BalanceOf> {
    return this.call<BalanceOf>('balanceOf', params)
  }

  decimals(): ContractReturn<Decimals> {
    return this.call<Decimals>('decimals', [], { subscribe: false })
  }

  symbol(): ContractReturn<TokenSymbol> {
    return this.call<TokenSymbol>('symbol', [], { subscribe: false })
  }

  createUnlockPermanentlyTx(spenderContractName: SupportedContractsNames): UnsignedTxOutput {
    const spenderAddress = getContractAddress(
      spenderContractName,
      this.root.web3Store.network.name,
      supportedContracts
    )

    if (!this.contract || !spenderAddress) {
      return { success: false, error: 'Something went wrong. Please try again later.' }
    }

    const data = this.contract.interface.encodeFunctionData('approve', [
      spenderAddress,
      UNLIMITED_AMOUNT_APPROVAL,
    ])

    return {
      success: true,
      tx: {
        to: this.address,
        data,
      },
    }
  }

  get balanceOfSigner(): BigNumber | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    const balanceRes = this.balanceOf(address)
    if (balanceRes === undefined) return undefined
    const [balance] = balanceRes
    return balance
  }

  get decimalsNumber(): number | undefined {
    const decimalsRes = this.decimals()
    if (decimalsRes === undefined) return undefined
    const [decimals] = decimalsRes
    return decimals
  }

  // we should return undefined when data is not available
  // so we can at least handle loading state instead of showing 0
  // which can be inaccurate information
  private get tokenBalanceRaw(): BigNumber | undefined {
    return this.balanceOfSigner ? this.balanceOfSigner : undefined
  }

  /**
   * Returns the tokenBalance as string
   * Decimal precision will be normalized with the amount configured in the application
   * @returns string
   */
  get tokenBalanceFormat(): string | undefined {
    return this.tokenBalanceRaw ? this.formatUnits(this.tokenBalanceRaw) : undefined
  }

  needsToAllowTokens(address: string | undefined, amount: BigNumber): boolean | undefined {
    if (!address) return undefined
    const allowance = this.signerAllowance(address)
    if (allowance === undefined || amount === undefined) return undefined
    return allowance.lt(amount)
  }

  needToAllowFor(
    amount: BigNumber | string,
    spenderContractName: SupportedContractsNames = 'UNISWAP_SWAP_ROUTER'
  ): boolean | undefined {
    const contractAddresses = supportedContracts[spenderContractName]
    const amountBN = typeof amount === 'string' ? parseUnits(amount, this.decimalsNumber) : amount
    if (!contractAddresses || amountBN === undefined) return undefined
    return this.needsToAllowTokens(contractAddresses[this.root.web3Store.network.name], amountBN)
  }

  signerAllowance(spenderAddress: string): BigNumber | undefined {
    this.checkingForAllowance = true
    const { address: signerAddress } = this.root.web3Store.signerState
    if (!signerAddress) return undefined
    const allowanceRes = this.allowance(signerAddress, spenderAddress)
    if (allowanceRes === undefined) return undefined
    const [allowance] = allowanceRes
    this.checkingForAllowance = false
    return allowance
  }

  signerNeedsMoreTokens(amount: BigNumber | undefined): boolean | undefined {
    if (!amount) return undefined
    if (!this.balanceOfSigner) return undefined
    return this.balanceOfSigner?.lt(amount)
  }

  formatUnits(value: BigNumber): string | undefined {
    if (this.decimalsNumber === undefined) return undefined
    return utils.formatUnits(value.toString(), this.decimalsNumber)
  }

  parseUnits(value: string): BigNumber | undefined {
    return parseUnits(value, this.decimalsNumber)
  }
}
