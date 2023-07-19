import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { allowedMsgSendersFixture } from './fixtures/AllowedMsgSendersFixture'
import { fakeAccountListFixture } from './fixtures/AccountListFixture'
import { AllowedMsgSenders } from '../types/generated'

chai.use(smock.matchers)

describe('=> AllowedMsgSenders', () => {
  let allowedCallers: AllowedMsgSenders
  let allowlist: FakeContract<Contract>

  beforeEach(async () => {
    allowedCallers = await allowedMsgSendersFixture()
    allowlist = await fakeAccountListFixture()
  })

  describe('initial state', () => {
    it('has no initial allowlist', async () => {
      expect(await allowedCallers.getAllowedMsgSenders()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    it('sets if zero address', async () => {
      await allowedCallers.setAllowedMsgSenders(ZERO_ADDRESS)

      expect(await allowedCallers.getAllowedMsgSenders()).to.eq(ZERO_ADDRESS)
    })

    it('sets if non-zero address', async () => {
      await allowedCallers.setAllowedMsgSenders(allowlist.address)

      expect(await allowedCallers.getAllowedMsgSenders()).to.eq(allowlist.address)
    })

    it('is idempotent', async () => {
      await allowedCallers.setAllowedMsgSenders(allowlist.address)
      expect(await allowedCallers.getAllowedMsgSenders()).to.eq(allowlist.address)

      await allowedCallers.setAllowedMsgSenders(allowlist.address)

      expect(await allowedCallers.getAllowedMsgSenders()).to.eq(allowlist.address)
    })

    it('emits AllowedMsgSendersChange', async () => {
      await expect(allowedCallers.setAllowedMsgSenders(allowlist.address))
        .to.emit(allowedCallers, 'AllowedMsgSendersChange')
        .withArgs(allowlist.address)
    })
  })
})
