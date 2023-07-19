import { Address, BigInt } from '@graphprotocol/graph-ts'
import { BalancerMetaStablePool } from '../generated/types/CollateralToken/BalancerMetaStablePool'

const wstEthWethBalancerPoolAddressString = '0x36bf227d6BaC96e2aB1EbB5492ECec69C691943f'
const wstEthAddressString = '0x5979D7b546E38E414F7E9822514be443A4800529'

export function getRateToEth(): BigInt {
  const wstEthWethBalancerPoolAddress = Address.fromString(wstEthWethBalancerPoolAddressString)
  const wstEthAddress = Address.fromString(wstEthAddressString)
  const balancerMetaStablePool = BalancerMetaStablePool.bind(wstEthWethBalancerPoolAddress)
  return balancerMetaStablePool.getPriceRateCache(wstEthAddress).getRate()
}
