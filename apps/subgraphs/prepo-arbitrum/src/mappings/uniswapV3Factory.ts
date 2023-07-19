import { BigInt } from '@graphprotocol/graph-ts'
import { TokenType } from '../utils/ERC20'
import { PoolCreated } from '../generated/types/UniswapV3Factory/UniswapV3Factory'
import { Pool, Token } from '../generated/types/schema'
import { ZERO_BD, ZERO_BI } from '../utils/constants'
import { UniswapV3Pool as UniswapV3PoolTemplate } from '../generated/types/templates'

export function handlePoolCreated(event: PoolCreated): void {
  const token0 = Token.load(event.params.token0.toHexString())
  const token1 = Token.load(event.params.token1.toHexString())

  // irrelevant pool
  if (token0 === null || token1 === null) return

  const tokenTypesList = [token0.type, token1.type]
  const hasLongShortToken = tokenTypesList.includes(TokenType.longShort)
  const hasCollateralToken = tokenTypesList.includes(TokenType.collateral)

  // a relevant pool has both long/short token and collateral token
  if (!hasLongShortToken || !hasCollateralToken) return

  const collateralTokenPosition = token0.type == TokenType.collateral ? 0 : 1

  const poolAddress = event.params.pool.toHexString()
  const pool = new Pool(poolAddress)
  pool.longShortToken = collateralTokenPosition === 0 ? token1.id : token0.id
  pool.collateralToken = collateralTokenPosition === 0 ? token0.id : token1.id
  pool.collateralTokenPosition = BigInt.fromI32(collateralTokenPosition)
  pool.token0 = token0.id
  pool.token1 = token1.id
  pool.fee = BigInt.fromI32(event.params.fee)
  pool.token0Price = ZERO_BD
  pool.token1Price = ZERO_BD
  pool.sqrtPriceX96 = ZERO_BI
  pool.createdAtBlockNumber = event.block.number
  pool.createdAtTimestamp = event.block.timestamp

  UniswapV3PoolTemplate.create(event.params.pool)

  pool.save()
}
