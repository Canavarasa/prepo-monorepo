import { FakeContract, smock } from '@defi-wonderland/smock'
import { parseEther } from '@ethersproject/units'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import chai, { expect } from 'chai'
import { formatBytes32String } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { PERCENT_UNIT, ZERO_ADDRESS } from 'prepo-constants'
import {
  AccountList,
  Collateral,
  PrePOMarket,
  MarketHook,
  TokenSender,
} from '../../types/generated'
import { fakeCollateralFixture } from '../fixtures/CollateralFixture'
import { fakeAccountListFixture, marketHookFixture } from '../fixtures/HookFixture'
import { fakePrePOMarketFixture } from '../fixtures/PrePOMarketFixture'
import { fakeTokenSenderFixture } from '../fixtures/TokenSenderFixture'
import { getSignerForContract } from '../utils'

chai.use(smock.matchers)

describe('=> MarketHook', () => {
  let deployer: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let governance: SignerWithAddress
  let marketHook: MarketHook
  let allowlist: FakeContract<AccountList>
  let tokenSender: FakeContract<TokenSender>
  let collateral: FakeContract<Collateral>
  let market: FakeContract<PrePOMarket>
  let marketSigner: SignerWithAddress
  const TEST_MULTIPLIER = PERCENT_UNIT * 2
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1')
  const TEST_AMOUNT_AFTER_FEE = TEST_AMOUNT_BEFORE_FEE.mul(99).div(100)
  const JUNK_PAYLOAD = formatBytes32String('JUNK_PAYLOAD')

  beforeEach(async () => {
    ;[deployer, user1, user2, governance] = await ethers.getSigners()
    marketHook = await marketHookFixture()
    allowlist = await fakeAccountListFixture()
    tokenSender = await fakeTokenSenderFixture()
  })

  describe('initial state', () => {
    it('sets deployer to owner', async () => {
      expect(await marketHook.owner()).eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await marketHook.getNominee()).eq(ZERO_ADDRESS)
    })
  })

  describe('# setAccountList', () => {
    it('reverts if not owner', async () => {
      expect(await marketHook.owner()).not.eq(user1.address)

      await expect(marketHook.connect(user1).setAccountList(allowlist.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await marketHook.owner()).eq(deployer.address)

      await marketHook.connect(deployer).setAccountList(allowlist.address)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not owner', async () => {
      expect(await marketHook.owner()).not.eq(user1.address)

      await expect(marketHook.connect(user1).setTreasury(user2.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await marketHook.owner()).eq(deployer.address)

      await marketHook.connect(deployer).setTreasury(user2.address)
    })
  })

  describe('# setAmountMultiplier', () => {
    it('reverts if not owner', async () => {
      expect(await marketHook.owner()).not.eq(user1.address)

      await expect(
        marketHook.connect(user1).setAmountMultiplier(deployer.address, TEST_MULTIPLIER)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('succeeds if owner', async () => {
      expect(await marketHook.owner()).eq(deployer.address)

      /**
       * In production, multipliers would be mapped to a specific market. This
       * is just a basic setter test so instead of setting up a market to map
       * a multiplier to, we just use the deployer address.
       */
      await marketHook.connect(deployer).setAmountMultiplier(deployer.address, TEST_MULTIPLIER)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not owner', async () => {
      expect(await marketHook.owner()).not.eq(user1.address)

      await expect(marketHook.connect(user1).setTokenSender(tokenSender.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await marketHook.owner()).eq(deployer.address)

      await marketHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })

  describe('# hook', () => {
    beforeEach(async () => {
      await marketHook.setAccountList(allowlist.address)
    })

    it('ignores allowlist if not set', async () => {
      await marketHook.setAccountList(ZERO_ADDRESS)

      await marketHook
        .connect(deployer)
        ['hook(address,address,uint256,uint256,bytes)'](
          user1.address,
          user1.address,
          1,
          1,
          JUNK_PAYLOAD
        )

      expect(allowlist.isIncluded).not.called
    })

    describe('fee reimbursement', () => {
      beforeEach(async () => {
        collateral = await fakeCollateralFixture()
        market = await fakePrePOMarketFixture()
        market.getCollateral.returns(collateral.address)
        marketSigner = await getSignerForContract(market)
        await marketHook.setAccountList(allowlist.address)
        await marketHook.setTreasury(governance.address)
        await marketHook.setAmountMultiplier(marketSigner.address, TEST_MULTIPLIER)
        await marketHook.setTokenSender(tokenSender.address)
      })

      it('transfers fee to treasury if fee > 0, funder not in allowlist, and funder = recipient', async () => {
        expect(await allowlist.isIncluded(user1.address)).eq(false)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(collateral.transferFrom).calledWith(market.address, governance.address, fee)
      })

      it('transfers fee to treasury if fee > 0, recipient in allowlist, and funder != recipient', async () => {
        expect(await allowlist.isIncluded(user1.address)).eq(false)
        await allowlist.connect(deployer).set([user2.address], [true])

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user2.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(collateral.transferFrom).calledWith(market.address, governance.address, fee)
      })

      it('calls tokenSender.send() if fee > 0 and redeemer = recipient', async () => {
        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(tokenSender.send).calledWith(
          user1.address,
          fee.mul(TEST_MULTIPLIER).div(PERCENT_UNIT)
        )
      })

      it('calls tokenSender.send() if fee > 0 and redeemer != recipient', async () => {
        expect(user1.address).not.eq(user2.address)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user2.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(tokenSender.send).calledWith(
          user2.address,
          fee.mul(TEST_MULTIPLIER).div(PERCENT_UNIT)
        )
      })

      it("doesn't transfer fee to recipient if fee = 0", async () => {
        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_BEFORE_FEE,
            JUNK_PAYLOAD
          )

        expect(collateral.transferFrom).not.called
      })

      it("doesn't call tokenSender.send() if fee = 0", async () => {
        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_BEFORE_FEE,
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      it("doesn't call tokenSender.send() if multiplier = 0", async () => {
        await marketHook.connect(deployer).setAmountMultiplier(marketSigner.address, 0)
        expect(TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)).gt(0)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      it("doesn't call tokenSender.send() if tokenSender not set", async () => {
        expect(TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)).gt(0)
        expect(await marketHook.getAmountMultiplier(marketSigner.address)).gt(0)
        await marketHook.connect(deployer).setTokenSender(ZERO_ADDRESS)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      it("doesn't call tokenSender.send() if scaled fee rounds to 0 from multiplier < 1", async () => {
        await marketHook.connect(deployer).setAmountMultiplier(marketSigner.address, 1)
        const feeToCauseRoundingToZero = PERCENT_UNIT - 1 // 1 * 999999 / 1000000 = 0

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_BEFORE_FEE.sub(feeToCauseRoundingToZero),
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      it("doesn't transfer fee to treasury if funder in allowlist and funder = recipient", async () => {
        allowlist.isIncluded.whenCalledWith(user1.address).returns(true)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(collateral.transferFrom).not.called
      })

      it("doesn't transfer fee to treasury if funder in allowlist and funder != recipient", async () => {
        allowlist.isIncluded.whenCalledWith(user1.address).returns(true)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user2.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(collateral.transferFrom).not.called
      })

      it("doesn't call tokenSender.send() if funder in allowlist and funder = recipient", async () => {
        allowlist.isIncluded.whenCalledWith(user1.address).returns(true)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user1.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      it("doesn't call tokenSender.send() if funder in allowlist and funder != recipient", async () => {
        allowlist.isIncluded.whenCalledWith(user1.address).returns(true)

        await marketHook
          .connect(marketSigner)
          ['hook(address,address,uint256,uint256,bytes)'](
            user1.address,
            user2.address,
            TEST_AMOUNT_BEFORE_FEE,
            TEST_AMOUNT_AFTER_FEE,
            JUNK_PAYLOAD
          )

        expect(tokenSender.send).not.called
      })

      afterEach(() => {
        collateral.transferFrom.reset()
        allowlist.isIncluded.reset()
      })
    })
  })

  afterEach(() => {
    allowlist.isIncluded.reset()
    tokenSender.send.reset()
  })
})
