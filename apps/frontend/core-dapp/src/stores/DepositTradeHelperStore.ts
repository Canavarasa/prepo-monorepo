import { BigNumber, ethers } from 'ethers'
import { ContractStore } from 'prepo-stores'
import { makeError } from 'prepo-utils'
import addDays from 'date-fns/fp/addDays'
import { formatEther } from 'ethers/lib/utils'
import { makeObservable } from 'mobx'
import { RootStore } from './RootStore'
import { BalancerStore } from './BalancerStore'
import { Erc20PermitStore } from './entities/Erc20Permit.entity'
import { SupportedContracts } from '../lib/contract.types'
import { DepositTradeHelperAbi, DepositTradeHelperAbi__factory } from '../../generated/typechain'

type TradeForCollateral = DepositTradeHelperAbi['functions']['tradeForCollateral']
type TradeForPosition = DepositTradeHelperAbi['functions']['tradeForPosition']
type WithdrawAndUnwrap =
  DepositTradeHelperAbi['functions']['withdrawAndUnwrap(address,uint256,(uint256,uint8,bytes32,bytes32),(uint256,uint256))']
type WrapAndDeposit =
  DepositTradeHelperAbi['functions']['wrapAndDeposit(address,(uint256,uint256))']
type WrapAndDepositAndTrade =
  DepositTradeHelperAbi['functions']['wrapAndDepositAndTrade(address,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))']

const getPermitDeadlineFromDate = addDays(1)
const getPermitDeadline = (): number =>
  Math.floor(getPermitDeadlineFromDate(Date.now()).getTime() / 1000)

type TxOutput = { success: boolean; error?: string; hash?: string }

export class DepositTradeHelperStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'DEPOSIT_TRADE_HELPER', DepositTradeHelperAbi__factory)
    makeObservable(this, {})
  }

  async tradeForCollateral({
    collateralAmountOut,
    needsPermit,
    positionToken,
    positionTokenAmount,
    recipient,
  }: {
    collateralAmountOut: BigNumber
    needsPermit: boolean
    positionToken: Erc20PermitStore
    positionTokenAmount: BigNumber
    recipient: string
  }): Promise<TxOutput> {
    const { address: depositTradeHelperAddress } = this

    if (depositTradeHelperAddress === undefined || positionToken.address === undefined)
      return {
        success: false,
        error: 'Something went wrong, please try again later.',
      }

    let hash: string | undefined
    try {
      const deadline = getPermitDeadline()
      let permit = Erc20PermitStore.EMPTY_PERMIT

      if (needsPermit) {
        const positionPermit = await positionToken.getPermitSignature(
          depositTradeHelperAddress,
          ethers.constants.MaxUint256,
          deadline
        )

        if (typeof positionPermit === 'string') {
          return { success: false, error: positionPermit }
        }

        permit = {
          ...positionPermit,
          deadline,
        }
      }

      const tx = await this.sendTransaction<TradeForCollateral>('tradeForCollateral', [
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

      hash = tx.hash
      await tx.wait()
      return { success: true, hash }
    } catch (e) {
      return { success: false, error: makeError(e).message, hash }
    }
  }

  async tradeForPosition({
    collateralAmount,
    needsPermit,
    positionToken,
    positionTokenAmountOut,
    recipient,
  }: {
    collateralAmount: BigNumber
    needsPermit: boolean
    positionToken: string
    positionTokenAmountOut: BigNumber
    recipient: string
  }): Promise<TxOutput> {
    const { address: depositTradeHelperAddress } = this

    if (depositTradeHelperAddress === undefined)
      return {
        success: false,
        error: 'Something went wrong, please try again later.',
      }

    let hash: string | undefined
    try {
      const deadline = getPermitDeadline()
      let permit = Erc20PermitStore.EMPTY_PERMIT

      if (needsPermit) {
        const collateralPermit = await this.root.collateralStore.getPermitSignature(
          depositTradeHelperAddress,
          ethers.constants.MaxUint256,
          deadline
        )

        if (typeof collateralPermit === 'string') {
          throw new Error('Something went wrong. Please try again later.')
        }

        permit = {
          ...collateralPermit,
          deadline,
        }
      }

      const tx = await this.sendTransaction<TradeForPosition>('tradeForPosition', [
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

      hash = tx.hash
      await tx.wait()

      return { success: true, hash }
    } catch (e) {
      return { success: false, error: makeError(e).message, hash }
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

  async wrapAndDepositAndTrade({
    amountInEth,
    expectedAmountInPositionToken,
    expectedIntermediateAmountInWstEth,
    needsPermit,
    positionToken,
    recipient,
  }: {
    amountInEth: BigNumber
    expectedAmountInPositionToken: BigNumber
    expectedIntermediateAmountInWstEth: BigNumber
    needsPermit: boolean
    positionToken: string
    recipient: string
  }): Promise<TxOutput> {
    if (this.address === undefined) {
      return {
        success: false,
        error: 'Something went wrong. Please try again later.',
      }
    }

    let hash: string | undefined

    try {
      const tradeDeadline = BalancerStore.getTradeDeadline()
      const permitDeadline = getPermitDeadline()

      let permit = Erc20PermitStore.EMPTY_PERMIT

      if (needsPermit) {
        const collateralPermit = await this.root.collateralStore.getPermitSignature(
          this.address,
          ethers.constants.MaxUint256,
          permitDeadline
        )

        if (typeof collateralPermit === 'string') {
          return { success: false, error: collateralPermit }
        }

        permit = {
          ...collateralPermit,
          deadline: permitDeadline,
        }
      }

      const tx = await this.sendTransaction<WrapAndDepositAndTrade>(
        'wrapAndDepositAndTrade(address,(uint256,uint256),(uint256,uint8,bytes32,bytes32),(address,uint256,uint256,uint160))',
        [
          recipient,
          {
            amountOutMinimum: this.root.advancedSettingsStore.getAmountAfterSlippageForDeposits(
              expectedIntermediateAmountInWstEth
            ),
            deadline: tradeDeadline,
          },
          permit,
          {
            amountOutMinimum: this.root.advancedSettingsStore.getAmountAfterSlippageForTrades(
              expectedAmountInPositionToken
            ),
            deadline: tradeDeadline,
            positionToken,
            sqrtPriceLimitX96: BigNumber.from(0),
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

  async withdrawAndUnwrap(
    recipient: string,
    amountIn: BigNumber,
    amountOut: BigNumber
  ): Promise<TxOutput> {
    let hash: string | undefined
    try {
      const amountOutMinimum =
        this.root.advancedSettingsStore.getAmountAfterSlippageForDeposits(amountOut)
      const { address: wstETHAddress } = this.root.baseTokenStore

      // impossible unless we forgot to set addresses
      if (!wstETHAddress || !recipient || !this.address || !this.contract)
        return { success: false, error: 'Something went wrong' }

      // button should be disabled
      if (!this.root.web3Store.signer?.provider)
        return { success: false, error: 'Wallet not connected.' }

      let permit = Erc20PermitStore.EMPTY_PERMIT

      if (this.needPermitForWithdrawAndUnwrap) {
        const deadline = getPermitDeadline()
        const signature = await this.root.collateralStore.getPermitSignature(
          this.address,
          ethers.constants.MaxUint256,
          deadline
        )

        if (typeof signature === 'string') return { success: false, error: signature }

        permit = {
          deadline,
          v: signature.v,
          s: signature.s,
          r: signature.r,
        }
      }

      const tx = await this.sendTransaction<WithdrawAndUnwrap>(
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
      hash = tx.hash
      await tx.wait()
      return { success: true, hash }
    } catch (e) {
      return { success: false, error: makeError(e).message, hash }
    }
  }

  get needPermitForWithdrawAndUnwrap(): boolean | undefined {
    return this.root.collateralStore.needToAllowFor(
      formatEther(ethers.constants.MaxUint256),
      'DEPOSIT_TRADE_HELPER'
    )
  }
}
