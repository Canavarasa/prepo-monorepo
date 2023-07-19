/* eslint-disable no-await-in-loop */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { accountListFixture } from './fixtures/AccountListFixture'
import { AccountList } from '../types/generated'

describe('=> AccountList', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let includedUser1: SignerWithAddress
  let includedUser2: SignerWithAddress
  let unincludedUser1: SignerWithAddress
  let unincludedUser2: SignerWithAddress
  let accountList: AccountList
  let includedUsersArray: string[]
  let unincludedUsersArray: string[]
  const arrayToIncludeAll = [true, true]
  const arrayToUnincludeAll = [false, false]

  const deployAccountList = async (): Promise<void> => {
    ;[deployer, owner, includedUser1, includedUser2, unincludedUser1, unincludedUser2] =
      await ethers.getSigners()
    accountList = await accountListFixture()
  }

  const setupAccountList = async (): Promise<void> => {
    await deployAccountList()
    includedUsersArray = [includedUser1.address, includedUser2.address]
    unincludedUsersArray = [unincludedUser1.address, unincludedUser2.address]
    await accountList.connect(deployer).transferOwnership(owner.address)
    await accountList.connect(owner).acceptOwnership()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployAccountList()
    })

    it('sets nominee to zero address', async () => {
      expect(await accountList.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await accountList.owner()).to.eq(deployer.address)
    })
  })

  describe('# set', () => {
    beforeEach(async () => {
      await setupAccountList()
    })

    it('reverts if not owner', async () => {
      expect(await accountList.owner()).not.eq(includedUser1.address)

      await expect(
        accountList.connect(includedUser1).set(includedUsersArray, arrayToIncludeAll)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      expect([includedUser1.address].length).not.eq(arrayToIncludeAll.length)

      await expect(
        accountList.connect(owner).set([includedUser1.address], arrayToIncludeAll)
      ).revertedWithCustomError(accountList, 'ArrayLengthMismatch')
    })

    it('includes single account', async () => {
      expect(await accountList.isIncluded(includedUser1.address)).eq(false)

      const tx = await accountList.connect(owner).set([includedUser1.address], [true])

      expect(await accountList.isIncluded(includedUser1.address)).eq(true)
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs([includedUser1.address], [true])
    })

    it('includes multiple accounts', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(false)
      }

      const tx = await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(true)
      }
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs(includedUsersArray, arrayToIncludeAll)
    })

    it('removes single account', async () => {
      await accountList.connect(owner).set([unincludedUser1.address], [true])
      expect(await accountList.isIncluded(unincludedUser1.address)).eq(true)

      const tx = await accountList.connect(owner).set([unincludedUser1.address], [false])

      expect(await accountList.isIncluded(unincludedUser1.address)).eq(false)
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs([unincludedUser1.address], [false])
    })

    it('removes multiple accounts', async () => {
      for (let i = 0; i < unincludedUsersArray.length; i++) {
        await accountList.connect(owner).set([unincludedUsersArray[i]], [true])
        expect(await accountList.isIncluded(unincludedUsersArray[i])).eq(true)
      }

      const tx = await accountList.connect(owner).set(unincludedUsersArray, arrayToUnincludeAll)

      for (let i = 0; i < unincludedUsersArray.length; i++) {
        expect(await accountList.isIncluded(unincludedUsersArray[i])).eq(false)
      }
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs(unincludedUsersArray, arrayToUnincludeAll)
    })

    it('includes and removes accounts', async () => {
      await accountList.connect(owner).set([unincludedUser1.address], [true])
      expect(await accountList.isIncluded(unincludedUser1.address)).eq(true)
      expect(await accountList.isIncluded(includedUser1.address)).eq(false)

      const tx = await accountList
        .connect(owner)
        .set([unincludedUser1.address, includedUser1.address], [false, true])

      expect(await accountList.isIncluded(unincludedUser1.address)).eq(false)
      expect(await accountList.isIncluded(includedUser1.address)).eq(true)
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs([unincludedUser1.address, includedUser1.address], [false, true])
    })

    it('sets to lattermost bool value if account passed multiple times', async () => {
      await accountList.connect(owner).set([includedUser1.address], [true])
      expect(await accountList.isIncluded(includedUser1.address)).eq(true)

      const tx = await accountList
        .connect(owner)
        .set([includedUser1.address, includedUser1.address], [true, false])

      expect(await accountList.isIncluded(includedUser1.address)).eq(false)
      await expect(tx)
        .emit(accountList, 'AccountListChange')
        .withArgs([includedUser1.address, includedUser1.address], [true, false])
    })

    it('is idempotent', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(false)
      }

      const tx1 = await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(true)
      }
      await expect(tx1)
        .emit(accountList, 'AccountListChange')
        .withArgs(includedUsersArray, arrayToIncludeAll)

      const tx2 = await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(true)
      }
      await expect(tx2)
        .emit(accountList, 'AccountListChange')
        .withArgs(includedUsersArray, arrayToIncludeAll)
    })
  })

  describe('# reset', () => {
    beforeEach(async () => {
      await setupAccountList()
      await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)
    })

    it('reverts if not owner', async () => {
      expect(await accountList.owner()).not.eq(includedUser1.address)

      await expect(accountList.connect(includedUser1).reset()).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('clears list', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(true)
      }

      const tx = await accountList.connect(owner).reset()

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).eq(false)
      }
      await expect(tx).to.emit(accountList, 'AccountListReset')
    })
  })

  describe('# getAccountAndInclusion', () => {
    beforeEach(async () => {
      await setupAccountList()
    })

    it('reverts if index out of bounds', async () => {
      await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      await expect(accountList.getAccountAndInclusion(includedUsersArray.length)).revertedWithPanic(
        '0x32'
      )
    })

    it('returns account and inclusion at multiple indices', async () => {
      await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      for (let i = 0; i < includedUsersArray.length; i++) {
        const accountAndInclusionAtIndex = await accountList.getAccountAndInclusion(i)
        expect(accountAndInclusionAtIndex[0]).eq(includedUsersArray[i])
        expect(accountAndInclusionAtIndex[1]).eq(arrayToIncludeAll[i])
      }
    })
  })

  describe('# getAccountListLength', () => {
    beforeEach(async () => {
      await setupAccountList()
    })

    it('returns 0 if list is empty', async () => {
      expect(await accountList.getAccountListLength()).eq(0)
    })

    it('returns length of non-empty list', async () => {
      await accountList.connect(owner).set(includedUsersArray, arrayToIncludeAll)

      expect(await accountList.getAccountListLength()).eq(includedUsersArray.length)
    })
  })
})
