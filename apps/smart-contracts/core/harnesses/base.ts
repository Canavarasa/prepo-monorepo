import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { BigNumber, BytesLike } from 'ethers'
import { POOL_FEE_TIER } from 'prepo-constants'
import { Create2Address, sendTxAndWait, utils } from 'prepo-hardhat'
import {
  mintCollateralFromBaseToken,
  mintLSFromCollateral,
  mintLSFromBaseToken,
  roleAssigners,
} from '../helpers'
import { attachUniV3Pool, getNearestSqrtX96FromWei } from '../helpers/uniswap'
import {
  ExtendedCollateral,
  MockExtendedCollateral,
  ExtendedDepositRecord,
  MockExtendedDepositRecord,
  ExtendedMarket,
  MockExtendedMarket,
} from '../types'
import {
  ArbitrageBroker,
  ERC20,
  DepositTradeHelper,
  TestERC20,
  UniswapV3Factory,
} from '../types/generated'

const { setSingleValueIfNotAlreadySet } = utils

export abstract class Base {
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20 | MockContract<TestERC20>
  public rewardToken: ERC20 | MockContract<TestERC20>
  public collateral: ExtendedCollateral | MockExtendedCollateral
  public depositRecord: ExtendedDepositRecord | MockExtendedDepositRecord
  public arbitrageBroker?: ArbitrageBroker | MockContract<ArbitrageBroker>
  public depositTradeHelper?: DepositTradeHelper | MockContract<DepositTradeHelper>
  public markets?: {
    [suffix: string]: ExtendedMarket | MockExtendedMarket
  }

  public mintCollateralFromBaseToken(
    funder: SignerWithAddress,
    recipient: string,
    collateralAmount: BigNumber
  ): Promise<BigNumber> {
    return mintCollateralFromBaseToken(
      this.ethers,
      funder,
      recipient,
      collateralAmount,
      this.collateral
    )
  }

  public async mintLSFromCollateral(
    funder: SignerWithAddress,
    recipient: string,
    lsAmount: BigNumber,
    marketSuffix: string,
    mintData = '0x'
  ): Promise<void> {
    await mintLSFromCollateral(
      this.ethers,
      funder,
      recipient,
      lsAmount,
      this.markets[marketSuffix],
      mintData
    )
  }

  public mintLSFromBaseToken(
    funder: SignerWithAddress,
    recipient: SignerWithAddress,
    lsAmount: BigNumber,
    marketSuffix: string,
    depositData = '0x',
    mintData = '0x'
  ): Promise<BigNumber> {
    return mintLSFromBaseToken(
      this.ethers,
      funder,
      recipient,
      lsAmount,
      this.markets[marketSuffix],
      depositData,
      mintData
    )
  }

  public async generateLongShortSalts(
    deployer: string,
    tokenNameSuffix: string,
    tokenSymbolSuffix: string,
    generateLowerAddress: (
      deployer: string,
      initCode: BytesLike,
      lowerBoundAddress: string
    ) => Create2Address
  ): Promise<Create2Address[]> {
    const longShortTokenFactory = await this.ethers.getContractFactory('LongShortToken')
    const longTokenDeployTx = longShortTokenFactory.getDeployTransaction(
      `LONG ${tokenNameSuffix}`,
      `L_${tokenSymbolSuffix}`
    )
    const longTokenSalt = generateLowerAddress(
      deployer,
      longTokenDeployTx.data,
      this.collateral.address
    )
    const shortTokenDeployTx = longShortTokenFactory.getDeployTransaction(
      `SHORT ${tokenNameSuffix}`,
      `S_${tokenSymbolSuffix}`
    )
    const shortTokenSalt = generateLowerAddress(
      deployer,
      shortTokenDeployTx.data,
      this.collateral.address
    )
    return [longTokenSalt, shortTokenSalt]
  }

  public async deployPoolsForMarket(
    tokenNameSuffix: string,
    univ3Factory: UniswapV3Factory,
    approxLongPoolWeiPrice: BigNumber,
    approxShortPoolWeiPrice: BigNumber
  ): Promise<void> {
    await univ3Factory.createPool(
      this.markets[tokenNameSuffix].longToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const longPoolAddress = await univ3Factory.getPool(
      this.markets[tokenNameSuffix].longToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const longPool = await attachUniV3Pool(this.ethers, longPoolAddress)
    await longPool.initialize(getNearestSqrtX96FromWei(approxLongPoolWeiPrice))
    await univ3Factory.createPool(
      this.markets[tokenNameSuffix].shortToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const shortPoolAddress = await univ3Factory.getPool(
      this.markets[tokenNameSuffix].shortToken.address,
      this.collateral.address,
      POOL_FEE_TIER
    )
    const shortPool = await attachUniV3Pool(this.ethers, shortPoolAddress)
    await shortPool.initialize(getNearestSqrtX96FromWei(approxShortPoolWeiPrice))
  }

  public async assignRolesForBaseStack(
    rootAdmin: SignerWithAddress,
    nominee: SignerWithAddress
  ): Promise<void> {
    await roleAssigners.assignCollateralRoles(rootAdmin, nominee, this.collateral)
    await roleAssigners.assignDepositRecordRoles(rootAdmin, nominee, this.depositRecord)
    await roleAssigners.assignDepositHookRoles(rootAdmin, nominee, this.collateral.depositHook)
    await roleAssigners.assignWithdrawHookRoles(rootAdmin, nominee, this.collateral.withdrawHook)
  }

  public async configureCollateralViaSigner(
    signer: SignerWithAddress,
    depositFee?: BigNumber | number,
    withdrawFee?: BigNumber | number
  ): Promise<void> {
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral,
      this.collateral.depositHook.address,
      'getDepositHook',
      'setDepositHook'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral,
      this.collateral.withdrawHook.address,
      'getWithdrawHook',
      'setWithdrawHook'
    )
    if (depositFee !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral,
        depositFee,
        'getDepositFee',
        'setDepositFee'
      )
    if (withdrawFee !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral,
        withdrawFee,
        'getWithdrawFee',
        'setWithdrawFee'
      )
  }

  public async configureDepositHookViaSigner(
    signer: SignerWithAddress,
    depositsAllowed?: boolean,
    treasury?: string
  ): Promise<void> {
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.collateral.address,
      'getCollateral',
      'setCollateral'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.depositRecord.address,
      'getDepositRecord',
      'setDepositRecord'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.depositHook,
      this.collateral.depositHook.tokenSender.address,
      'getTokenSender',
      'setTokenSender'
    )
    if (depositsAllowed !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral.depositHook,
        depositsAllowed,
        'depositsAllowed',
        'setDepositsAllowed'
      )
    if (treasury !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral.depositHook,
        treasury,
        'getTreasury',
        'setTreasury'
      )
  }

  public async configureWithdrawHookViaSigner(
    signer: SignerWithAddress,
    globalPeriodLength?: BigNumber | number,
    globalWithdrawLimitPerPeriod?: BigNumber | number,
    treasury?: string
  ): Promise<void> {
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.withdrawHook,
      this.collateral.address,
      'getCollateral',
      'setCollateral'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.withdrawHook,
      this.depositRecord.address,
      'getDepositRecord',
      'setDepositRecord'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.collateral.withdrawHook,
      this.collateral.withdrawHook.tokenSender.address,
      'getTokenSender',
      'setTokenSender'
    )
    if (globalPeriodLength !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral.withdrawHook,
        globalPeriodLength,
        'getGlobalPeriodLength',
        'setGlobalPeriodLength'
      )
    if (globalWithdrawLimitPerPeriod !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral.withdrawHook,
        globalWithdrawLimitPerPeriod,
        'getGlobalWithdrawLimitPerPeriod',
        'setGlobalWithdrawLimitPerPeriod'
      )
    if (treasury !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.collateral.withdrawHook,
        treasury,
        'getTreasury',
        'setTreasury'
      )
  }

  public async configureDepositRecordViaSigner(
    signer: SignerWithAddress,
    globalNetDepositCap?: BigNumber | number,
    userDepositCap?: BigNumber | number,
    allowedMsgSenders?: string[],
    bypasslist?: string[]
  ): Promise<void> {
    await setSingleValueIfNotAlreadySet(
      signer,
      this.depositRecord,
      this.depositRecord.allowedMsgSenders.address,
      'getAllowedMsgSenders',
      'setAllowedMsgSenders'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.depositRecord,
      this.depositRecord.bypasslist.address,
      'getAccountList',
      'setAccountList'
    )
    if (globalNetDepositCap !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.depositRecord,
        globalNetDepositCap,
        'getGlobalNetDepositCap',
        'setGlobalNetDepositCap'
      )
    if (userDepositCap !== undefined)
      await setSingleValueIfNotAlreadySet(
        signer,
        this.depositRecord,
        userDepositCap,
        'getUserDepositCap',
        'setUserDepositCap'
      )
    if (allowedMsgSenders !== undefined && allowedMsgSenders.length > 0) {
      await sendTxAndWait(
        await this.depositRecord.allowedMsgSenders
          .connect(signer)
          .set(allowedMsgSenders, new Array(allowedMsgSenders.length).fill(true))
      )
    }
    if (bypasslist !== undefined && bypasslist.length > 0) {
      await sendTxAndWait(
        await this.depositRecord.bypasslist
          .connect(signer)
          .set(bypasslist, new Array(bypasslist.length).fill(true))
      )
    }
  }
}
