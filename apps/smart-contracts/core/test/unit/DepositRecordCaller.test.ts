import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { depositRecordCallerFixture } from '../fixtures/DepositRecordCallerFixture'
import { DepositRecordCaller } from '../../types/generated'

describe('=> AccountListCaller', () => {
  let depositRecordCaller: DepositRecordCaller
  let depositRecord: SignerWithAddress

  beforeEach(async () => {
    ;[depositRecord] = await ethers.getSigners()
    depositRecordCaller = await depositRecordCallerFixture()
  })

  describe('initial state', () => {
    it('sets deposit record to zero address', async () => {
      expect(await depositRecordCaller.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setDepositRecord', () => {
    it('sets to non-zero address', async () => {
      expect(await depositRecordCaller.getDepositRecord()).to.eq(ZERO_ADDRESS)

      await depositRecordCaller.setDepositRecord(depositRecord.address)

      expect(await depositRecordCaller.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('sets to zero address', async () => {
      await depositRecordCaller.setDepositRecord(depositRecord.address)
      expect(await depositRecordCaller.getDepositRecord()).to.eq(depositRecord.address)

      await depositRecordCaller.setDepositRecord(ZERO_ADDRESS)

      expect(await depositRecordCaller.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await depositRecordCaller.setDepositRecord(depositRecord.address)
      expect(await depositRecordCaller.getDepositRecord()).to.eq(depositRecord.address)

      await depositRecordCaller.setDepositRecord(depositRecord.address)

      expect(await depositRecordCaller.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('emits DepositRecordChange', async () => {
      await expect(depositRecordCaller.setDepositRecord(depositRecord.address))
        .to.emit(depositRecordCaller, 'DepositRecordChange')
        .withArgs(depositRecord.address)
    })
  })
})
