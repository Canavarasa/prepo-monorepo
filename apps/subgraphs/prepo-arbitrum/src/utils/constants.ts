import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

// ... addresses ...
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ... numbers ...
export const ERC20_DENOMINATORS = BigInt.fromI32(10).pow(18)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_BI = BigInt.fromI32(0)
export const ZERO_BD = BigDecimal.fromString('0')

export const PRE_WSTETH_ADDRESS = '0x67a5246e2DbbD51250b41128EA277674C65e8dee'.toLowerCase()
export const ALLOWED_COLLATERAL = [PRE_WSTETH_ADDRESS]

export class TransactionType {
  static get deposit(): string {
    return 'DEPOSIT'
  }
  static get withdraw(): string {
    return 'WITHDRAW'
  }
  static get redeem(): string {
    return 'REDEEM'
  }
  static get open(): string {
    return 'OPEN'
  }
  static get close(): string {
    return 'CLOSE'
  }
}
