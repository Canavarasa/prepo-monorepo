/* eslint-disable max-classes-per-file */
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { MockContract } from '@defi-wonderland/smock'
import { utils } from 'prepo-hardhat'
import { Base } from './base'
import {
  MockExtendedCollateral,
  MockExtendedDepositRecord,
  MockExtendedMarket,
  MockExtendedTokenSender,
  StandaloneCreateMarketParams,
} from '../types'
import { AddressBeacon, Create2Deployer, ERC20, TestERC20, UintBeacon } from '../types/generated'
import { smockCollateralFixture } from '../test/fixtures/CollateralFixture'
import { smockDepositHookFixture, smockWithdrawHookFixture } from '../test/fixtures/HookFixture'
import { smockTestERC20Fixture } from '../test/fixtures/TestERC20Fixture'
import { smockDepositRecordFixture } from '../test/fixtures/DepositRecordFixture'
import { smockTokenSenderFixture } from '../test/fixtures/TokenSenderFixture'
import { create2LongShortTokenFixture } from '../test/fixtures/LongShortTokenFixture'
import { smockPrePOMarketFixture } from '../test/fixtures/PrePOMarketFixture'
import { mockAddressBeaconFixture, mockUintBeaconFixture } from '../test/fixtures/BeaconFixtures'

abstract class MockCore extends Base {
  public rewardToken: MockContract<TestERC20>
  public collateral: MockExtendedCollateral
  public depositRecord: MockExtendedDepositRecord
  public tokenSender: MockExtendedTokenSender
  public addressBeacon: MockContract<AddressBeacon>
  public uintBeacon: MockContract<UintBeacon>
  public markets?: {
    [suffix: string]: MockExtendedMarket
  }

  async initWithoutBaseToken(ethers: HardhatEthersHelpers): Promise<MockCore> {
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    this.rewardToken = await smockTestERC20Fixture('Test PPO', 'TPPO', 18)
    this.depositRecord = await smockDepositRecordFixture()
    this.tokenSender = await smockTokenSenderFixture(this.rewardToken.address, 18)
    this.addressBeacon = await mockAddressBeaconFixture()
    this.uintBeacon = await mockUintBeaconFixture()
    this.markets = {}
    return this
  }

  public async createAndAddMockMarket(
    tokenNameSuffix: string,
    tokenSymbolSuffix: string,
    marketParams: StandaloneCreateMarketParams,
    deployerFactory: Create2Deployer
  ): Promise<void> {
    const tokenSalts = await this.generateLongShortSalts(
      deployerFactory.address,
      tokenNameSuffix,
      tokenSymbolSuffix,
      utils.generateLowerAddress
    )
    const longToken = await create2LongShortTokenFixture(
      `LONG ${tokenNameSuffix}`,
      `L_${tokenSymbolSuffix}`,
      deployerFactory,
      tokenSalts[0]
    )
    const shortToken = await create2LongShortTokenFixture(
      `SHORT ${tokenNameSuffix}`,
      `S_${tokenSymbolSuffix}`,
      deployerFactory,
      tokenSalts[1]
    )
    const market = await smockPrePOMarketFixture({
      ...marketParams,
      longToken: longToken.address,
      shortToken: shortToken.address,
    })
    await deployerFactory.transferOwnership(longToken.address, market.address)
    await deployerFactory.transferOwnership(shortToken.address, market.address)
    this.markets[tokenNameSuffix] = market
    this.markets[tokenNameSuffix].longToken = longToken
    this.markets[tokenNameSuffix].shortToken = shortToken
  }
}

export class MockCoreWithMockBaseToken extends MockCore {
  private static _instance: MockCoreWithMockBaseToken
  public baseToken: MockContract<TestERC20>

  public static get Instance(): MockCoreWithMockBaseToken {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(ethers: HardhatEthersHelpers): Promise<MockCoreWithMockBaseToken> {
    await this.initWithoutBaseToken(ethers)
    this.baseToken = await smockTestERC20Fixture('Test ETH', 'TETH', 18)
    this.collateral = await smockCollateralFixture(
      'prePO ETH Collateral',
      'preETH',
      this.baseToken.address,
      await this.baseToken.decimals()
    )
    this.collateral.depositHook = await smockDepositHookFixture()
    this.collateral.withdrawHook = await smockWithdrawHookFixture(18)
    return this
  }
}

export class MockCoreWithLiveBaseToken extends MockCore {
  private static _instance: MockCoreWithLiveBaseToken
  public baseToken: ERC20

  public static get Instance(): MockCoreWithLiveBaseToken {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(
    ethers: HardhatEthersHelpers,
    baseToken: ERC20
  ): Promise<MockCoreWithLiveBaseToken> {
    await this.initWithoutBaseToken(ethers)
    this.baseToken = baseToken
    this.collateral = await smockCollateralFixture(
      'prePO ETH Collateral',
      'preETH',
      this.baseToken.address,
      await this.baseToken.decimals()
    )
    this.collateral.depositHook = await smockDepositHookFixture()
    this.collateral.withdrawHook = await smockWithdrawHookFixture(18)
    return this
  }
}
