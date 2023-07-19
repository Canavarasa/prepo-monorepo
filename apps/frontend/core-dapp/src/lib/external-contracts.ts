import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedExternalContractsNames =
  | 'USDC'
  | 'UNISWAP_SWAP_ROUTER'
  | 'UNISWAP_QUOTER'
  | 'BALANCER_VAULT'
  | 'WSTETH_WETH_BALANCER_POOL'
  | 'BASE_FEE_GETTER'

export const USDC_ADDRESS: ExternalContract = {
  mainnet: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  ropsten: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
}

export const UNISWAP_SWAP_ROUTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  mainnet: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
}

export const UNISWAP_QUOTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  mainnet: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
}

export const BALANCER_VAULT_ADDRESS: ExternalContract = {
  arbitrumOne: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
}

export const WSTETH_WETH_BALANCER_POOL_ADDRESSES: ExternalContract = {
  arbitrumOne: '0x36bf227d6BaC96e2aB1EbB5492ECec69C691943f',
}

export const BASE_FEE_GETTER_ADDRESS: ExternalContract = {
  arbitrumOne: '0xacb0b03e821dc2abeb145341ff507cf0b843864a',
}

export const supportedExternalTokenContracts: SupportedContracts = {
  USDC: USDC_ADDRESS,
  UNISWAP_SWAP_ROUTER: UNISWAP_SWAP_ROUTER_ADDRESS,
  UNISWAP_QUOTER: UNISWAP_QUOTER_ADDRESS,
  BALANCER_VAULT: BALANCER_VAULT_ADDRESS,
  WSTETH_WETH_BALANCER_POOL: WSTETH_WETH_BALANCER_POOL_ADDRESSES,
  BASE_FEE_GETTER: BASE_FEE_GETTER_ADDRESS,
}
