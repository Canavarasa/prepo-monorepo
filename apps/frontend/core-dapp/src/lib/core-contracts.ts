import { DYNAMIC_CONTRACT_ADDRESS } from 'prepo-stores'
import { ExternalContract } from './contract.types'

export type CoreTokenContractNames =
  | 'WETH'
  | 'WSTETH'
  | 'COLLATERAL'
  | 'PPO'
  | 'DEPOSIT_TRADE_HELPER'
  | 'DYNAMIC'

export type CoreContracts = {
  [key in CoreTokenContractNames]: ExternalContract
}

// wstETH
export const BASE_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x5979D7b546E38E414F7E9822514be443A4800529',
}

// WETH
export const WETH_ADDRESS: ExternalContract = {
  arbitrumOne: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
}

// preWstETH
export const COLLATERAL_TOKEN_ADDRESS: ExternalContract = {
  arbitrumOne: '0x67a5246e2DbbD51250b41128EA277674C65e8dee',
}

export const PPO_ADDRESS: ExternalContract = {
  arbitrumOne: '0xB40DBBb7931Cfef8Be73AEEC6c67d3809bD4600B',
}

export const DEPOSIT_TRADE_HELPER_ADDRESS: ExternalContract = {
  arbitrumOne: '0x6DA2F6cE51A0E0fA2DB04d5829d255163CB0ca86',
}

export const DYNAMIC_ADDRESS: ExternalContract = {
  arbitrumOne: DYNAMIC_CONTRACT_ADDRESS,
}

export const coreContracts: CoreContracts = {
  WSTETH: BASE_TOKEN_ADDRESS,
  WETH: WETH_ADDRESS,
  COLLATERAL: COLLATERAL_TOKEN_ADDRESS,
  PPO: PPO_ADDRESS,
  DEPOSIT_TRADE_HELPER: DEPOSIT_TRADE_HELPER_ADDRESS,
  DYNAMIC: DYNAMIC_ADDRESS,
}
