import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { allowedCollateralCallerFixture } from '../fixtures/AllowedCollateralCallerFixture'
import { AllowedCollateralCaller } from '../../types/generated'

describe('=> AllowedCollateralCaller', () => {
  let allowedCollateralCaller: AllowedCollateralCaller
  let deployer: SignerWithAddress
  let collateral: SignerWithAddress
  beforeEach(async () => {
    ;[deployer, collateral] = await ethers.getSigners()
    allowedCollateralCaller = await allowedCollateralCallerFixture()
  })

  describe('# initialize', () => {
    it('sets collateral to zero address', async () => {
      expect(await allowedCollateralCaller.getCollateral()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setCollateral', () => {
    it('sets to non-zero address', async () => {
      expect(await allowedCollateralCaller.getCollateral()).to.eq(ZERO_ADDRESS)

      await allowedCollateralCaller.setCollateral(collateral.address)

      expect(await allowedCollateralCaller.getCollateral()).to.eq(collateral.address)
    })

    it('sets to zero address', async () => {
      await allowedCollateralCaller.connect(deployer).setCollateral(collateral.address)
      expect(await allowedCollateralCaller.getCollateral()).to.eq(collateral.address)

      await allowedCollateralCaller.setCollateral(ZERO_ADDRESS)

      expect(await allowedCollateralCaller.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await allowedCollateralCaller.getCollateral()).to.eq(ZERO_ADDRESS)
      await allowedCollateralCaller.connect(deployer).setCollateral(collateral.address)
      expect(await allowedCollateralCaller.getCollateral()).to.eq(collateral.address)

      await allowedCollateralCaller.connect(deployer).setCollateral(collateral.address)

      expect(await allowedCollateralCaller.getCollateral()).to.eq(collateral.address)
    })

    it('emits CollateralChange', async () => {
      const tx = await allowedCollateralCaller.connect(deployer).setCollateral(collateral.address)

      await expect(tx)
        .to.emit(allowedCollateralCaller, 'CollateralChange')
        .withArgs(collateral.address)
    })
  })
})
