import { BigNumber, utils } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import minBy from 'lodash/minBy'

export type BalanceLimitStatus = {
  capEth: BigNumber | undefined
  currentAmountEth: BigNumber | undefined
}

export type DepositLimitStatusHolder = {
  globalLimit: BalanceLimitStatus
  userLimit: BalanceLimitStatus
}

// Below this threshold, usually the gas costs are greater than the value of the transaction
export const DUST_THRESHOLD = parseEther('0.0001').sub(1)

export type BalanceLimitInfo =
  | {
      status: 'loading'
    }
  | {
      status: 'not-exceeded' | 'already-exceeded' | 'exceeded-after-transfer'
      amountEth: string
      capEth: string
      remainingEth: string
    }

export type DepositLimit =
  | {
      status: 'loading' | 'web3-not-ready' | 'not-exceeded'
    }
  | {
      amountEth: string
      capEth: string
      remainingEth: string
      status: 'already-exceeded' | 'exceeded-after-transfer'
      type: 'user-limit' | 'global-limit'
    }

export function getBalanceLimitInfo({
  additionalAmount,
  cap,
  currentAmount,
}: {
  additionalAmount: BigNumber | undefined
  cap: BigNumber | undefined
  currentAmount: BigNumber | undefined
}): BalanceLimitInfo {
  if (currentAmount === undefined || cap === undefined || additionalAmount === undefined) {
    return { status: 'loading' }
  }

  let status: 'already-exceeded' | 'not-exceeded' | 'exceeded-after-transfer'

  // Due to slippage, it is unlikely that users will deposit the exact remaining
  // amount. They will typically leave room for dust, therefore the cap will
  // never technically be exceeded. Therefore, to calculate the cap, we
  // subtract a tiny amount of ETH to account for dust.
  const adjustedCap = cap.sub(DUST_THRESHOLD)

  if (currentAmount.gte(adjustedCap)) {
    status = 'already-exceeded'
  } else if (currentAmount.add(additionalAmount).gt(cap)) {
    status = 'exceeded-after-transfer'
  } else {
    status = 'not-exceeded'
  }

  const remainingAmount = cap.sub(currentAmount)

  return {
    amountEth: utils.formatEther(currentAmount),
    capEth: utils.formatEther(cap),
    remainingEth: utils.formatEther(remainingAmount.gte(0) ? remainingAmount : BigNumber.from(0)),
    status,
  }
}

export function getDepositLimit({
  connected,
  depositAmount,
  depositRecordStore: { globalLimit, userLimit },
  isNetworkSupported,
}: {
  connected: boolean
  depositAmount: BigNumber | undefined
  depositRecordStore: DepositLimitStatusHolder
  isNetworkSupported: boolean
}): DepositLimit {
  const globalDepositLimitInfo = getBalanceLimitInfo({
    additionalAmount: depositAmount,
    cap: globalLimit.capEth,
    currentAmount: globalLimit.currentAmountEth,
  })

  let userDepositLimitInfo: BalanceLimitInfo | { status: 'web3-not-ready' }

  if (connected && isNetworkSupported) {
    userDepositLimitInfo = getBalanceLimitInfo({
      additionalAmount: depositAmount,
      cap: userLimit.capEth,
      currentAmount: userLimit.currentAmountEth,
    })
  } else {
    userDepositLimitInfo = { status: 'web3-not-ready' }
  }

  if (globalDepositLimitInfo.status === 'loading' || userDepositLimitInfo.status === 'loading') {
    return { status: 'loading' }
  }

  if (globalDepositLimitInfo.status === 'already-exceeded') {
    return {
      ...globalDepositLimitInfo,
      type: 'global-limit',
    }
  }

  if (userDepositLimitInfo.status === 'already-exceeded') {
    return {
      ...userDepositLimitInfo,
      type: 'user-limit',
    }
  }

  const lowestLimit = minBy(
    [globalDepositLimitInfo, userDepositLimitInfo].filter(
      (limit): limit is BalanceLimitInfo & { status: 'exceeded-after-transfer' } =>
        limit.status === 'exceeded-after-transfer'
    ),
    (limit) => +limit.remainingEth
  )

  if (lowestLimit) {
    return {
      ...lowestLimit,
      type: lowestLimit === globalDepositLimitInfo ? 'global-limit' : 'user-limit',
    }
  }

  if (userDepositLimitInfo.status === 'web3-not-ready') {
    return {
      status: 'web3-not-ready',
    }
  }

  return { status: 'not-exceeded' }
}
