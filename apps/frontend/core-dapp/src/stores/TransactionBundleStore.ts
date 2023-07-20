/* eslint-disable @typescript-eslint/no-throw-literal */
import { BigNumber, constants, UnsignedTransaction } from 'ethers'
import { makeAutoObservable, runInAction } from 'mobx'
import { generateGasOptions } from 'prepo-stores'
import { getContractAddress, makeError } from 'prepo-utils'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { hexlify, hexValue } from 'ethers/lib/utils'
import type SafeAppsSDK from '@safe-global/safe-apps-sdk'
import retry from 'async-retry'
import { RootStore } from './RootStore'
import { Erc20PermitStore, SignedPermit } from './entities/Erc20Permit.entity'
import { getPermitDeadline } from './DepositTradeHelperStore'
import { SupportedContractsNames } from '../lib/contract.types'
import { supportedContracts } from '../lib/supported-contracts'
import { TxOutput, UnsignedTxOutput } from '../types/transaction.types'
import { enumerate } from '../utils/string-utils'

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
  private safeTxStatusMessage: string | undefined

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

  private get canBundle(): boolean {
    return !!this.root.web3Store.safeAppsSdk
  }

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
    const { canBundle, canSign, hasAllowance, safeTxStatusMessage, transacting } = this
    const names = this.actionNames()
    if (!canSign && hasAllowance === false) {
      if (!canBundle) return 'Approve'
      if (transacting && safeTxStatusMessage) return safeTxStatusMessage
      return enumerate('Approve', ...names)
    }
    return enumerate(...names)
  }

  get initialLoading(): boolean {
    return this.hasAllowance === undefined
  }

  // endregion

  // region actions

  async execute(): Promise<void> {
    const { canBundle, canSign, hasAllowance } = this

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
      } else if (canBundle) {
        const { approveTx } = this
        const { safeAppsSdk } = this.root.web3Store

        const actionTx = await this.actionTx(Erc20PermitStore.EMPTY_PERMIT)

        if (
          !safeAppsSdk ||
          !approveTx ||
          !approveTx.to ||
          !approveTx.data ||
          !actionTx.tx ||
          !actionTx.tx.to ||
          !actionTx.tx.data
        )
          throw TransactionBundleStore.UNEXPECTED_ERROR

        const response = await safeAppsSdk.txs.send({
          txs: [
            {
              to: approveTx.to,
              data: hexlify(approveTx.data),
              value: hexValue(approveTx.value ?? BigNumber.from(0)),
            },
            {
              to: actionTx.tx.to,
              data: hexlify(actionTx.tx.data),
              value: hexValue(actionTx.tx.value ?? BigNumber.from(0)),
            },
          ],
          params: {
            safeTxGas: BigNumber.from(approveTx.gasLimit ?? 0)
              .add(BigNumber.from(actionTx.tx.gasLimit ?? 0))
              .toNumber(),
          },
        })

        const executionResult = await this.waitForSafeTxExecution({
          safeAppsSdk,
          safeTxHash: response.safeTxHash,
        })

        if (executionResult.success && executionResult.hash) {
          await this.handlers.onAfterTransactionSuccess?.({
            hash: executionResult.hash,
            type: 'action',
          })
        } else {
          throw executionResult.error
        }
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

  private async waitForSafeTxExecution({
    safeAppsSdk,
    safeTxHash,
  }: {
    safeAppsSdk: SafeAppsSDK
    safeTxHash: string
  }): Promise<TxOutput> {
    /* eslint-disable no-constant-condition,default-case,no-await-in-loop */

    try {
      const { TransactionStatus } = await import('@safe-global/safe-apps-sdk')

      while (true) {
        const receipt = await retry(() => safeAppsSdk.txs.getBySafeTxHash(safeTxHash))

        switch (receipt.txStatus) {
          case TransactionStatus.AWAITING_CONFIRMATIONS: {
            runInAction(() => {
              this.safeTxStatusMessage = 'Confirm in Safe{Wallet}'
            })
            break
          }
          case TransactionStatus.AWAITING_EXECUTION: {
            runInAction(() => {
              this.safeTxStatusMessage = 'Execute in Safe{Wallet}'
            })
            break
          }
          case TransactionStatus.SUCCESS: {
            return {
              success: true,
              hash: receipt.txHash,
            }
          }
          case TransactionStatus.CANCELLED: {
            return {
              success: false,
              error: 'Transaction cancelled in Safe{Wallet}.',
            }
          }
          case TransactionStatus.FAILED: {
            return {
              success: false,
              error: 'Transaction execution failed. Check details in Safe{Wallet}.',
            }
          }
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 15_000)
        })
      }
    } finally {
      runInAction(() => {
        this.safeTxStatusMessage = undefined
      })
    }

    /* eslint-enable */
  }

  // endregion

  static UNEXPECTED_ERROR = 'Something went wrong. Please try again later.'
}
