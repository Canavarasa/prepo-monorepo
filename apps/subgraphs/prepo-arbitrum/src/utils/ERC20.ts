import { Address, BigInt } from '@graphprotocol/graph-ts'
import { ALLOWED_COLLATERAL } from './constants'
import { CollateralToken, Token } from '../generated/types/schema'
import { ERC20 as ERC20Contract } from '../generated/types/UniswapV3Factory/ERC20'

export class TokenType {
  static get collateral(): string {
    return 'COLLATERAL'
  }
  static get longShort(): string {
    return 'LONG_SHORT'
  }
}

// keep track of all tokens related to us
export function fetchERC20(tokenAddress: Address, type: string): Token | null {
  let token = Token.load(tokenAddress.toHexString())
  if (token === null) {
    token = new Token(tokenAddress.toHexString())
    const decimalsResult = ERC20Contract.bind(tokenAddress).try_decimals()
    const nameResult = ERC20Contract.bind(tokenAddress).try_name()
    const symbolResult = ERC20Contract.bind(tokenAddress).try_symbol()

    // invalid erc20
    if (decimalsResult.reverted || nameResult.reverted || symbolResult.reverted) return null

    token.decimals = BigInt.fromI32(decimalsResult.value)
    token.name = nameResult.value
    token.symbol = symbolResult.value
    token.type = type

    token.save()
  }
  return token
}

export function fetchCollateralToken(tokenAddress: Address): CollateralToken | null {
  const collateralErc20 = fetchERC20(tokenAddress, TokenType.collateral)
  if (collateralErc20 === null) return null

  const tokenAddressString = tokenAddress.toHexString()
  let token = CollateralToken.load(tokenAddressString)

  if (token === null) {
    token = new CollateralToken(tokenAddressString)
    token.allowed = ALLOWED_COLLATERAL.includes(tokenAddressString)
    token.save()
  }
  return token as CollateralToken
}
