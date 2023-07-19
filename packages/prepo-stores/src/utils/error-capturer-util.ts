import { makeError } from 'prepo-utils'
import { CaptureError } from './stores.types'

const irrelevantErrors = [
  'missing revert data in call exception', // etherjs BaseProvider error
  'missing revert data in call exception; Transaction reverted without a reason string', // etherjs JsonRpcProvider error
  'failed to meet quorum', // fallback provider error
  // Happens when the user leaves the tab and comes back after a while.
  'network block skew detected',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isImportantError = (error: any): boolean => !irrelevantErrors.includes(error.reason)

enum MetamaskErrorMessages {
  SLIPPAGE_ERROR = 'execution reverted: Too little received',
  DENIED_TRANSACTION = 'MetaMask Tx Signature: User denied transaction signature.',
  SMART_CONTRACT_EXECUTION_REVERTED = 'execution reverted: STF',
}

const userFriendlyErrorMessages: {
  [key in MetamaskErrorMessages]: string
} = {
  [MetamaskErrorMessages.SLIPPAGE_ERROR]:
    'The trading price has changed too much since you last checked. Please try again or change your slippage options.',
  [MetamaskErrorMessages.DENIED_TRANSACTION]:
    'Transaction denied by the user. Please accept the transaction on MetaMask.',
  [MetamaskErrorMessages.SMART_CONTRACT_EXECUTION_REVERTED]:
    'The execution of the contract has been reverted. Please try again. Contact an administrator if the problem persists.',
}

export const friendlyErrorMessageCapturer: CaptureError = (err) => {
  const error = makeError(err)
  error.message =
    userFriendlyErrorMessages[error.message as keyof typeof userFriendlyErrorMessages] ??
    error.message
  return error
}
