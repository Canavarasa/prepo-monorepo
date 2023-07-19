import { BigNumber, Contract } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  DEPLOYMENT_NAMES,
  getPrePOAddressForNetwork,
  Network,
  DEFAULT_ADMIN_ROLE,
} from 'prepo-constants'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  deployNonUpgradeableContract,
  sendTxAndWait,
  setSingleValueIfNotAlreadySet,
  utils,
} from 'prepo-hardhat'
import { ProposalStep } from 'defender-admin-client/lib/models/proposal'
import { Base } from './base'
import { ERC20AttachFixture } from '../test/fixtures/ERC20Fixture'
import { ExtendedCollateral, ExtendedDepositRecord, ExtendedMarket } from '../types'
import {
  ArbitrageBroker,
  DepositTradeHelper,
  ERC20,
  PrePOMarketFactory,
  UniswapV3OracleUintValue,
} from '../types/generated'
import { roleAssigners, roleGranters, roleProposalStepGetters } from '../helpers'

const { getAcceptOwnershipSteps, getContractsAccountIsNotRoleHolderOf } = utils

export class ProdCore extends Base {
  private static _instance: ProdCore
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20
  public rewardToken: ERC20
  public ppoUSDCtoETHOracle?: UniswapV3OracleUintValue
  public collateral: ExtendedCollateral
  public depositRecord: ExtendedDepositRecord
  public marketFactory?: PrePOMarketFactory
  public arbitrageBroker?: ArbitrageBroker
  public depositTradeHelper?: DepositTradeHelper
  public markets?: {
    [suffix: string]: ExtendedMarket
  }

  public static get Instance(): ProdCore {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(ethers: HardhatEthersHelpers, currentNetwork: Network): Promise<ProdCore> {
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    const wstethAddress = getPrePOAddressForNetwork(
      'WSTETH',
      currentNetwork.name,
      process.env.WSTETH
    )
    this.baseToken = await ERC20AttachFixture(ethers, wstethAddress)
    const ppoAddress = getPrePOAddressForNetwork('PPO', currentNetwork.name, process.env.PPO)
    this.rewardToken = await ERC20AttachFixture(ethers, ppoAddress)
    this.ppoUSDCtoETHOracle = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.ppoUSDCtoETHOracle.name
    )
    this.collateral = await ethers.getContract(DEPLOYMENT_NAMES.preWstETH.name)
    this.collateral.depositHook = await ethers.getContract(
      DEPLOYMENT_NAMES.preWstETH.depositHook.name
    )
    this.collateral.depositHook.tokenSender = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.name
    )
    if (this.collateral.depositHook.tokenSender) {
      this.collateral.depositHook.tokenSender.allowedMsgSenders = await ethers.getContractOrNull(
        DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.depositHook.tokenSender.twapPrice = this.ppoUSDCtoETHOracle
    }
    this.collateral.withdrawHook = await ethers.getContract(
      DEPLOYMENT_NAMES.preWstETH.withdrawHook.name
    )
    this.collateral.withdrawHook.tokenSender = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.name
    )
    if (this.collateral.withdrawHook.tokenSender) {
      this.collateral.withdrawHook.tokenSender.allowedMsgSenders = await ethers.getContractOrNull(
        DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.withdrawHook.tokenSender.twapPrice = this.ppoUSDCtoETHOracle
    }
    this.depositRecord = await ethers.getContract(DEPLOYMENT_NAMES.preWstETH.depositRecord.name)
    this.depositRecord.allowedMsgSenders = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preWstETH.depositRecord.allowedMsgSenders.name
    )
    this.depositRecord.bypasslist = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.preWstETH.depositRecord.bypasslist.name
    )
    this.marketFactory = await ethers.getContractOrNull(DEPLOYMENT_NAMES.prePOMarketFactory.name)
    this.arbitrageBroker = await ethers.getContractOrNull(DEPLOYMENT_NAMES.arbitrageBroker.name)
    this.depositTradeHelper = await ethers.getContractOrNull(
      DEPLOYMENT_NAMES.depositTradeHelper.name
    )
    this.markets = {}
    return this
  }

  public async deployTokenSenderAndPeriphery(
    hre: HardhatRuntimeEnvironment,
    tokenSenderName: string,
    allowedMsgSendersName: string
  ): Promise<void> {
    await deployNonUpgradeableContract(
      'TokenSender',
      tokenSenderName,
      [this.rewardToken.address, 18],
      hre
    )
    await deployNonUpgradeableContract('AccountList', allowedMsgSendersName, [], hre)
  }

  public async deployPeripheralContracts(hre: HardhatRuntimeEnvironment): Promise<void> {
    const { ethers } = hre
    if (this.depositRecord.allowedMsgSenders == null) {
      await deployNonUpgradeableContract(
        'AccountList',
        DEPLOYMENT_NAMES.preWstETH.depositRecord.allowedMsgSenders.name,
        [],
        hre
      )
      this.depositRecord.allowedMsgSenders = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.depositRecord.allowedMsgSenders.name
      )
    }
    if (this.depositRecord.bypasslist == null) {
      await deployNonUpgradeableContract(
        'AccountList',
        DEPLOYMENT_NAMES.preWstETH.depositRecord.bypasslist.name,
        [],
        hre
      )
      this.depositRecord.bypasslist = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.depositRecord.bypasslist.name
      )
    }
    if (this.collateral.depositHook.tokenSender == null) {
      await this.deployTokenSenderAndPeriphery(
        hre,
        DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.name,
        DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.depositHook.tokenSender = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.name
      )
      this.collateral.depositHook.tokenSender.allowedMsgSenders = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.depositHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.depositHook.tokenSender.twapPrice = this.ppoUSDCtoETHOracle
    }
    if (this.collateral.withdrawHook.tokenSender == null) {
      await this.deployTokenSenderAndPeriphery(
        hre,
        DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.name,
        DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.withdrawHook.tokenSender = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.name
      )
      this.collateral.withdrawHook.tokenSender.allowedMsgSenders = await ethers.getContract(
        DEPLOYMENT_NAMES.preWstETH.withdrawHook.tokenSender.allowedMsgSenders.name
      )
      this.collateral.withdrawHook.tokenSender.twapPrice = this.ppoUSDCtoETHOracle
    }
  }

  public async assignRolesForProdStack(
    rootAdmin: SignerWithAddress,
    nominee: SignerWithAddress
  ): Promise<void> {
    await this.assignRolesForBaseStack(rootAdmin, nominee)
    await roleAssigners.assignTokenSenderRoles(
      rootAdmin,
      nominee,
      this.collateral.depositHook.tokenSender
    )
    await roleAssigners.assignTokenSenderRoles(
      rootAdmin,
      nominee,
      this.collateral.withdrawHook.tokenSender
    )
    await roleAssigners.assignPrePOMarketFactoryRoles(rootAdmin, nominee, this.marketFactory)
    await roleAssigners.assignArbitrageBrokerRoles(rootAdmin, nominee, this.arbitrageBroker)
  }

  public async configurePrePOMarketFactoryViaSigner(signer: SignerWithAddress): Promise<void> {
    await sendTxAndWait(
      await this.marketFactory.connect(signer).setCollateralValidity(this.collateral.address, true)
    )
  }

  public async configureUniswapV3OracleUintValueViaSigner(
    signer: SignerWithAddress,
    observationPeriod: number,
    baseAmount: BigNumber | number
  ): Promise<void> {
    await setSingleValueIfNotAlreadySet(
      signer,
      this.ppoUSDCtoETHOracle,
      observationPeriod,
      'getObservationPeriod',
      'setObservationPeriod'
    )
    await setSingleValueIfNotAlreadySet(
      signer,
      this.ppoUSDCtoETHOracle,
      baseAmount,
      'getBaseAmount',
      'setBaseAmount'
    )
  }

  public async grantRolesForProdStack(
    rootAdmin: SignerWithAddress,
    nomineeAddress: string
  ): Promise<void> {
    await roleGranters.grantCollateralRoles(rootAdmin, nomineeAddress, this.collateral)
    await roleGranters.grantDepositRecordRoles(rootAdmin, nomineeAddress, this.depositRecord)
    await roleGranters.grantDepositHookRoles(rootAdmin, nomineeAddress, this.collateral.depositHook)
    await roleGranters.grantTokenSenderRoles(
      rootAdmin,
      nomineeAddress,
      this.collateral.depositHook.tokenSender
    )
    await roleGranters.grantWithdrawHookRoles(
      rootAdmin,
      nomineeAddress,
      this.collateral.withdrawHook
    )
    await roleGranters.grantTokenSenderRoles(
      rootAdmin,
      nomineeAddress,
      this.collateral.withdrawHook.tokenSender
    )
    await roleGranters.grantPrePOMarketFactoryRoles(rootAdmin, nomineeAddress, this.marketFactory)
  }

  public getAcceptRoleStepsForProdStack(network: Network): ProposalStep[] {
    return roleProposalStepGetters
      .getCollateralAcceptRoleSteps(network, this.collateral)
      .concat(
        roleProposalStepGetters.getDepositRecordAcceptRoleSteps(network, this.depositRecord),
        roleProposalStepGetters.getDepositHookAcceptRoleSteps(network, this.collateral.depositHook),
        roleProposalStepGetters.getTokenSenderAcceptRoleSteps(
          network,
          this.collateral.depositHook.tokenSender
        ),
        roleProposalStepGetters.getWithdrawHookAcceptRoleSteps(
          network,
          this.collateral.withdrawHook
        ),
        roleProposalStepGetters.getTokenSenderAcceptRoleSteps(
          network,
          this.collateral.withdrawHook.tokenSender
        ),
        roleProposalStepGetters.getPrePOMarketFactoryAcceptRoleSteps(network, this.marketFactory)
      )
  }

  public async transferOwnershipForProdStack(
    owner: SignerWithAddress,
    nomineeAddress: string
  ): Promise<void> {
    // TODO refactor to also ensure if already owned, to not call transferOwnership
    await setSingleValueIfNotAlreadySet(
      owner,
      this.ppoUSDCtoETHOracle,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
    await setSingleValueIfNotAlreadySet(
      owner,
      this.depositRecord.allowedMsgSenders,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
    await setSingleValueIfNotAlreadySet(
      owner,
      this.depositRecord.bypasslist,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
    await setSingleValueIfNotAlreadySet(
      owner,
      this.collateral.depositHook.tokenSender.allowedMsgSenders,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
    await setSingleValueIfNotAlreadySet(
      owner,
      this.collateral.withdrawHook.tokenSender.allowedMsgSenders,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
    await setSingleValueIfNotAlreadySet(
      owner,
      this.depositTradeHelper,
      nomineeAddress,
      'getNominee',
      'transferOwnership'
    )
  }

  public getAcceptOwnershipStepsForProdStack(network: Network): ProposalStep[] {
    return getAcceptOwnershipSteps(network, [
      this.ppoUSDCtoETHOracle,
      this.depositRecord.allowedMsgSenders,
      this.depositRecord.bypasslist,
      this.collateral.depositHook.tokenSender.allowedMsgSenders,
      this.collateral.withdrawHook.tokenSender.allowedMsgSenders,
      this.depositTradeHelper,
    ])
  }

  public async getProdStackContractsAccountIsNotDefaultAdminFor(
    accountAddress: string
  ): Promise<Contract[]> {
    const contractsAccountIsNotDefaultAdminFor = await getContractsAccountIsNotRoleHolderOf(
      [
        this.collateral,
        this.depositRecord,
        this.collateral.depositHook,
        this.collateral.withdrawHook,
        this.collateral.depositHook.tokenSender,
        this.collateral.withdrawHook.tokenSender,
        this.marketFactory,
      ],
      accountAddress,
      DEFAULT_ADMIN_ROLE
    )
    return contractsAccountIsNotDefaultAdminFor
  }

  public getRevokeRoleStepsForProdStack(
    network: Network,
    roleHolderAddress: string
  ): ProposalStep[] {
    return roleProposalStepGetters
      .getCollateralRevokeRoleSteps(network, roleHolderAddress, this.collateral)
      .concat(
        roleProposalStepGetters.getDepositRecordRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.depositRecord
        ),
        roleProposalStepGetters.getDepositHookRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.collateral.depositHook
        ),
        roleProposalStepGetters.getWithdrawHookRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.collateral.withdrawHook
        ),
        roleProposalStepGetters.getTokenSenderRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.collateral.depositHook.tokenSender
        ),
        roleProposalStepGetters.getTokenSenderRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.collateral.withdrawHook.tokenSender
        ),
        roleProposalStepGetters.getPrePOMarketFactoryRevokeRoleSteps(
          network,
          roleHolderAddress,
          this.marketFactory
        )
      )
  }
}
