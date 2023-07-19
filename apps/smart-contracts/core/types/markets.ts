import { ContractTransaction } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PrePOMarketFactory } from './generated'
import { IPrePOMarket } from './generated/artifacts/contracts/PrePOMarket'

export type StandaloneCreateMarketParams = {
  deployer: SignerWithAddress
  longToken?: string
  shortToken?: string
  addressBeacon?: string
  uintBeacon?: string
  parameters: IPrePOMarket.MarketParametersStruct
}

export type CreateMarketParams = {
  factory: PrePOMarketFactory
  tokenNameSuffix: string
  tokenSymbolSuffix: string
  longTokenSalt: string
  shortTokenSalt: string
  parameters: IPrePOMarket.MarketParametersStruct
}

export type CreateMarketResult = {
  tx: ContractTransaction
  market: string
}
