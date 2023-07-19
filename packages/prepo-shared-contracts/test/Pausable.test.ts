import { expect } from 'chai'
import { pausableTestFixture } from './fixtures/PausableFixture'
import { PausableTest } from '../types/generated'

describe('Pausable', () => {
  let pausable: PausableTest

  const setupPausable = async (): Promise<void> => {
    pausable = await pausableTestFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('is not paused', async () => {
      expect(await pausable.isPaused()).eq(false)
    })
  })

  describe('# setPaused', () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('pauses', async () => {
      expect(await pausable.isPaused()).eq(false)

      await pausable.setPaused(true)

      expect(await pausable.isPaused()).eq(true)
    })

    it('unpauses', async () => {
      await pausable.setPaused(true)
      expect(await pausable.isPaused()).eq(true)

      await pausable.setPaused(false)

      expect(await pausable.isPaused()).eq(false)
    })

    it('is idempotent', async () => {
      expect(await pausable.isPaused()).eq(false)

      await pausable.setPaused(true)

      expect(await pausable.isPaused()).eq(true)

      await pausable.setPaused(true)

      expect(await pausable.isPaused()).eq(true)
    })

    it('emits paused change if paused', async () => {
      const tx = await pausable.setPaused(true)

      await expect(tx).emit(pausable, 'PausedChange(bool)').withArgs(true)
    })

    it('emits paused change if unpaused', async () => {
      const tx = await pausable.setPaused(false)

      await expect(tx).emit(pausable, 'PausedChange(bool)').withArgs(false)
    })
  })

  describe('# testWhenNotPaused', () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('reverts if paused', async () => {
      await pausable.setPaused(true)
      expect(await pausable.isPaused()).eq(true)

      await expect(pausable.testWhenNotPaused()).revertedWithCustomError(pausable, 'Paused')
    })

    it('succeeds if not paused', async () => {
      await pausable.setPaused(false)
      expect(await pausable.isPaused()).eq(false)

      await pausable.testWhenNotPaused()
    })
  })
})
