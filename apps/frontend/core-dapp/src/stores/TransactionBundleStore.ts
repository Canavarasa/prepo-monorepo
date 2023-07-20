/* eslint-disable @typescript-eslint/no-throw-literal */
import { BigNumber, constants, UnsignedTransaction } from 'ethers'
import { makeAutoObservable, runInAction } from 'mobx'
import { generateGasOptions } from 'prepo-stores'
import { getContractAddress, makeError } from 'prepo-utils'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { RootStore } from './RootStore'
import { Erc20PermitStore, SignedPermit } from './entities/Erc20Permit.entity'
import { getPermitDeadline } from './DepositTradeHelperStore'
import { SupportedContractsNames } from '../lib/contract.types'
import { supportedContracts } from '../lib/supported-contracts'
import { UnsignedTxOutput } from '../types/transaction.types'

type ActionNamesCreator = () => readonly string[]

type ActionTxCreator = (permit: SignedPermit) => UnsignedTxOutput | Promise<UnsignedTxOutput>

type Handlers = {
  onAfterTransactionSuccess?: (params: { hash: string; type: 'approval' | 'action' }) => void
  onError: (params: { error: string; hash?: string }) => void
}

type RequiredApprovalCreator = () => {
  amount: BigNumber | undefined
  spender: SupportedContractsNames
  token: Erc20PermitStore | undefined
}

export class TransactionBundleStore {
  private readonly actionNames: ActionNamesCreator
  private readonly actionTx: ActionTxCreator
  private readonly handlers: Handlers
  private readonly requiredApproval: RequiredApprovalCreator
  private readonly root: RootStore
  transacting = false

  constructor({
    actionNames,
    actionTxCreator,
    requiredApproval,
    root,
    ...handlers
  }: {
    actionNames: ActionNamesCreator
    actionTxCreator: ActionTxCreator
    requiredApproval: RequiredApprovalCreator
    root: RootStore
  } & Handlers) {
    this.actionNames = actionNames
    this.actionTx = actionTxCreator
    this.handlers = handlers
    this.requiredApproval = requiredApproval
    this.root = root

    makeAutoObservable(this, {}, { autoBind: true })
  }

  // region getters

  private get canSign(): boolean {
    return !this.root.web3Store.signerState.isContract
  }

  private get hasAllowance(): boolean | undefined {
    const { amount, spender, token } = this.requiredApproval()
    if (amount === undefined || token === undefined) return undefined
    return !token.needToAllowFor(amount, spender)
  }

  private get approveTx(): UnsignedTransaction | undefined {
    const { spender, token } = this.requiredApproval()
    if (token === undefined) return undefined
    return token.createUnlockPermanentlyTx(spender).tx
  }

  get actionLabel(): string {
    const { canSign, hasAllowance } = this
    const names = this.actionNames()
    if (!canSign && hasAllowance === false) return 'Approve'
    return names.join(' And ')
  }

  get initialLoading(): boolean {
    return this.hasAllowance === undefined
  }

  // endregion

  // region actions

  async execute(): Promise<void> {
    const { canSign, hasAllowance } = this

    let hash: string | undefined

    try {
      if (hasAllowance === undefined) throw TransactionBundleStore.UNEXPECTED_ERROR

      this.transacting = true

      if (canSign || hasAllowance) {
        const permitResult = await this.requestPermit()
        if (!permitResult.permit)
          throw permitResult.error ?? TransactionBundleStore.UNEXPECTED_ERROR

        const txResult = await this.actionTx(permitResult.permit)
        if (!txResult.tx) throw txResult.error ?? TransactionBundleStore.UNEXPECTED_ERROR

        const tx = await this.sendTransaction(txResult.tx)
        hash = tx.hash
        await tx.wait()

        this.handlers.onAfterTransactionSuccess?.({
          hash,
          type: 'action',
        })
      } else {
        const { approveTx } = this
        if (!approveTx) throw TransactionBundleStore.UNEXPECTED_ERROR

        const tx = await this.sendTransaction(approveTx)
        hash = tx.hash
        await tx.wait()

        this.handlers.onAfterTransactionSuccess?.({
          hash: tx.hash,
          type: 'approval',
        })
      }
    } catch (e) {
      this.handlers.onError({
        error: makeError(e).message,
        hash,
      })
    } finally {
      runInAction(() => {
        this.transacting = false
      })
    }
  }

  private async requestPermit(): Promise<{
    success: boolean
    error?: string
    permit?: SignedPermit
  }> {
    const { network } = this.root.web3Store
    const { hasAllowance } = this
    const { spender, token } = this.requiredApproval()

    const spenderAddress = getContractAddress(spender, network.name, supportedContracts)

    if (token === undefined || hasAllowance === undefined || spenderAddress === undefined)
      return {
        success: false,
        error: 'Something went wrong. Please try again later.',
      }
    if (hasAllowance)
      return {
        success: true,
        permit: Erc20PermitStore.EMPTY_PERMIT,
      }

    const deadline = getPermitDeadline()

    const result = await token.getPermitSignature(spenderAddress, constants.MaxUint256, deadline)

    if (typeof result === 'string')
      return {
        success: false,
        error: result,
      }

    return {
      success: true,
      permit: {
        ...result,
        deadline,
      },
    }
  }

  private async sendTransaction(tx: UnsignedTransaction): Promise<TransactionResponse> {
    const { signer } = this.root.web3Store

    if (!signer) throw new Error('Wallet not connected')

    const gasOptions = await generateGasOptions(signer, tx)

    return signer.sendTransaction({
      ...tx,
      ...gasOptions,
      type: 2,
    })
  }

  // endregion

  static UNEXPECTED_ERROR = 'Something went wrong. Please try again later.'
}
