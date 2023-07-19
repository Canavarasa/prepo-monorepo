// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const IS_BROWSER = typeof window !== 'undefined'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const JUNK_ADDRESS = '0x0000000000000000000000000000000000000001'
/* Safe decimals place JS can handle  */
export const SAFE_DECIMALS = 10

export const UNLIMITED_AMOUNT_APPROVAL =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

export const CURRENCY_PRECISION = 2
export const ETH_STRING = 'ETH'

export const SEC_IN_MS = 1000
export const MIN_IN_MS = SEC_IN_MS * 60
export const HOUR_IN_MS = MIN_IN_MS * 60

export const MINIMUM_GAS_FEE = 21000

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

export const DEFAULT_ADMIN_ROLE = ZERO_BYTES32

// We use FallbackProvider to have some redundancy
// Use QUORUM of 1 because we trust the endpoints and prioritise speed
// STALL_TIMEOUT is how many ms until FallbackProvider will wait until trying the next provider
export const FALLBACK_PROVIDER_CONFIG = {
  STALL_TIMEOUT: SEC_IN_MS,
  QUORUM: 1,
}

export const POOL_FEE_TIER = 100

export const USDC_DENOMINATOR = 1000000

export const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

export const WALLETCONNECT_PROJECT_ID = '7aca6b865db379bb48e1ee5cef2e2c8c'
