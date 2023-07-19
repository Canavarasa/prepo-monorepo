import { makeAutoObservable } from 'mobx'
import { AddressBeaconEntity } from './entities/AddressBeaconEntity'
import { RootStore } from './RootStore'
import { TokenSenderEntity_v1_1 } from './entities/TokenSenderEntity_v1_1'

/**
 * Keeps track of all resources that could be reused by multiple contracts, like
 * - AddressBeacon
 * - TokenSender
 * - ValueBeacon
 */
export class ResourceStore {
  addressBeacons: Record<string, AddressBeaconEntity | undefined> = {}
  tokenSenders: Record<string, TokenSenderEntity_v1_1> = {}
  constructor(public readonly root: RootStore) {
    makeAutoObservable(this)
  }

  getAddressBeacon(address?: string): AddressBeaconEntity | undefined {
    if (!address) return undefined
    let addressBeacon = this.addressBeacons[address]
    if (!addressBeacon) {
      addressBeacon = new AddressBeaconEntity(this.root, address)
      this.addressBeacons[address] = addressBeacon
    }
    return this.addressBeacons[address]
  }

  getTokenSender(address?: string): TokenSenderEntity_v1_1 | undefined {
    if (!address) return undefined
    let tokenSender = this.tokenSenders[address]
    if (!tokenSender) {
      tokenSender = new TokenSenderEntity_v1_1(this.root, () => address)
      this.tokenSenders[address] = tokenSender
    }
    return this.tokenSenders[address]
  }
}
