import { BigNumber } from 'ethers'
import { ContractStore } from 'prepo-stores'
import { makeError } from 'prepo-utils'
import addDays from 'date-fns/fp/addDays'
import { makeObservable } from 'mobx'
import { RootStore } from './RootStore'
import { BalancerStore } from './BalancerStore'
import { Erc20PermitStore, SignedPermit } from './entities/Erc20Permit.entity'
import { SupportedContracts } from '../lib/contract.types'
import { DepositTradeHelperAbi, DepositTradeHelperAbi__factory } from '../../generated/typechain'
import { TxOutput, UnsignedTxOutput } from '../types/transaction.types'

type WrapAndDeposit =
  DepositTradeHelperAbi['functions']['wrapAndDeposit(address,(uint256,uint256))']

const getPermitDeadlineFromDate = addDays(1)
export const getPermitDeadline = (): number =>
  Math.floor(getPermitDeadlineFromDate(Date.now()).getTime() / 1000)

export class DepositTradeHelperStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'DEPOSIT_TRADE_HELPER', DepositTradeHelperAbi__factory)
    makeObservable(this, {})
  }

  createTradeForCollateralTx({
    collateralAmountOut,
    permit,
    positionToken,
    positionTokenAmount,
    recipient,
  }: {
    collateralAmountOut: BigNumber
    permit: SignedPermit
    positionToken: Erc20PermitStore
    positionTokenAmount: BigNumber
    recipient: string
  }): UnsignedTxOutput {
    if (!this.contract || positionToken.address === undefined)
      return {
        success: false,
        error: 'Something went wrong, please try again later.',
      }

    const deadline = BalancerStore.getTradeDeadline()

    const data = this.contract.interface.encodeFunctionData('tradeForCollateral', [
      recipient,
      positionTokenAmount,
      permit,
      {
        amountOutMinimum:
          this.root.advancedSettingsStore.getAmountAfterSlippageForTrades(collateralAmountOut),
        deadline,
        positionToken: positionToken.address,
        sqrtPriceLimitX96: BigNumber.from(0),
      },
    ])

    return {
      success: true,
      tx: {
        data,
        to: this.address,
      },
    }
  }

  createTradeForPositionTx({
    collateralAmount,
    permit,
    positionToken,
    positionTokenAmountOut,
    recipient,
  }: {
    collateralAmount: BigNumber
    permit: SignedPermit
    positionToken: string
    positionTokenAmountOut: BigNumber
    recipient: string
  }): UnsignedTxOutput {
    if (this.address === undefined || this.contract === undefined)
      return {
        success: false,
        error: 'Something went wrong, please try again later.',
      }

    const deadline = BalancerStore.getTradeDeadline()

    const data = this.contract.interface.encodeFunctionData('tradeForPosition', [
      recipient,
      collateralAmount,
      permit,
      {
        amountOutMinimum:
          this.root.advancedSettingsStore.getAmountAfterSlippageForTrades(positionTokenAmountOut),
        deadline,
        positionToken,
        sqrtPriceLimitX96: BigNumber.from(0),
      },
    ])

    return {
      success: true,
      tx: {
        data,
        to: this.address,
      },
    }
  }

  async wrapAndDeposit(recipient: string, amountInEth: BigNumber): Promise<TxOutput> {
    let hash: string | undefined
    try {
      const amountInWstEth =
        this.root.balancerStore.getEthAmountInWstEthWithPriceImpact(amountInEth)

      if (amountInWstEth === undefined) {
        return {
          success: false,
          error: 'Failed to fetch the wstETH price.',
        }
      }

      if (
        this.root.advancedSettingsStore.isEthWstEthPriceImpactTooHigh(amountInWstEth.priceImpact)
      ) {
        return {
          success: false,
          error: "Can't swap to wstETH: price impact too high. Try a smaller amount.",
        }
      }

      const wstEthAfterSlippage = this.root.advancedSettingsStore.getAmountAfterSlippageForDeposits(
        amountInWstEth.value
      )

      const tx = await this.sendTransaction<WrapAndDeposit>(
        'wrapAndDeposit(address,(uint256,uint256))',
        [
          recipient,
          {
            amountOutMinimum: wstEthAfterSlippage,
            deadline: BalancerStore.getTradeDeadline(),
          },
        ],
        {
          value: amountInEth,
        }
      )
      hash = tx.hash
      await tx.wait()
      return { success: true, hash }
    } catch (e) {
      return { success: false, error: makeError(e).message, hash }
    }
  }

  createWrapAndDepositAndTradeTx({
    amountInEth,
    expectedAmountInPositionToken,
    expectedIntermediateAmountInWstEth,
    permit,
    positionToken,
    recipient,
  }: {
    amountInEth: BigNumber
    expectedAmountInPositionToken: BigNumber
    expectedIntermediateAmountInWstEth: BigNumber
    permit: SignedPermit
    positionToken: string
    recipient: string
  }): UnsignedTxOutput {
    if (this.address === undefined || this.contract === undefined) {
      return {
        success: false,
        error: 'Something went wrong. Please try again later.',
      }
    }

    try {
      const deadline = BalancerStore.getTradeDeadline()

      const data = this.contract.interface.encodeFunctionData(
        'wrapAndDepositAndTrade(address,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))',
        [
          recipient,
          {
            amountOutMinimum: this.root.advancedSettingsStore.getAmountAfterSlippageForDeposits(
              expectedIntermediateAmountInWstEth
            ),
            deadline,
          },
          permit,
          {
            amountOutMinimum: this.root.advancedSettingsStore.getAmountAfterSlippageForTrades(
              expectedAmountInPositionToken
            ),
            deadline,
            positionToken,
            sqrtPriceLimitX96: BigNumber.from(0),
          },
        ]
      )

      return {
        success: true,
        tx: {
          data,
          to: this.address,
          value: amountInEth,
        },
      }
    } catch (e) {
      return { success: false, error: makeError(e).message }
    }
  }

  createWithdrawAndUnwrapTx({
    amountIn,
    amountOut,
    permit,
    recipient,
  }: {
    amountIn: BigNumber
    amountOut: BigNumber
    permit: SignedPermit
    recipient: string
  }): UnsignedTxOutput {
    const amountOutMinimum =
      this.root.advancedSettingsStore.getAmountAfterSlippageForDeposits(amountOut)

    // impossible unless we forgot to set addresses
    if (!recipient || !this.address || !this.contract)
      return { success: false, error: 'Something went wrong' }

    const data = this.contract.interface.encodeFunctionData(
      'withdrawAndUnwrap(address,uint256,(uint256,uint8,bytes32,bytes32),(uint256,uint256))',
      [
        recipient,
        amountIn,
        permit,
        {
          amountOutMinimum,
          deadline: BalancerStore.getTradeDeadline(),
        },
      ]
    )

    return {
      success: true,
      tx: {
        data,
        to: this.address,
      },
    }
  }
}
