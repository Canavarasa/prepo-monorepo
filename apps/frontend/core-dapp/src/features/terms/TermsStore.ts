import { makeAutoObservable } from 'mobx'
import config from '../../lib/config'
import { RootStore } from '../../stores/RootStore'

export class TermsStore {
  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  private hasAddressAgreedToRules(address: string): boolean {
    const { storage } = this.root.localStorageStore
    const { agreedRules } = storage
    return Boolean(agreedRules?.[config.termsVersion]?.[address])
  }

  private hasAddressAgreedToTerms(address: string): boolean {
    const { storage } = this.root.localStorageStore
    const { agreedTerms } = storage
    return Boolean(agreedTerms?.[config.termsVersion]?.[address])
  }

  get showTermsPage(): boolean {
    return (
      (!this.agreedToCurrentRules || !this.agreedToCurrentTerms) && !this.root.web3Store.connecting
    )
  }

  get agreedToCurrentRules(): boolean {
    const { address } = this.root.web3Store
    if (address === undefined) return true
    return this.hasAddressAgreedToRules(address)
  }

  get agreedToCurrentTerms(): boolean {
    const { address } = this.root.web3Store
    if (address === undefined) return true
    return this.hasAddressAgreedToTerms(address)
  }

  agreeToRules(): void {
    const { address } = this.root.web3Store
    const { storage } = this.root.localStorageStore
    const { agreedRules } = storage

    if (address === undefined) return

    this.root.localStorageStore.storage.agreedRules = {
      ...agreedRules,
      [config.rulesVersion]: {
        ...agreedRules?.[config.rulesVersion],
        [address]: true,
      },
    }
  }

  agreeToTerms(): void {
    const { address } = this.root.web3Store
    const { storage } = this.root.localStorageStore
    const { agreedTerms } = storage

    if (address === undefined) return

    this.root.localStorageStore.storage.agreedTerms = {
      ...agreedTerms,
      [config.termsVersion]: {
        ...agreedTerms?.[config.termsVersion],
        [address]: true,
      },
    }
  }
}
