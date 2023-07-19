/* eslint-disable max-classes-per-file */

import { ethers } from 'ethers'
import retry from 'async-retry'
import { Networkish } from '@ethersproject/networks'
import { Network, SEC_IN_MS } from 'prepo-constants'
import { computed, makeObservable, observable, runInAction } from 'mobx'

// Take the JsonRpcBatchProvider and give it the detectNetwork method of the StaticJsonRpcProvider
export class StaticJsonRpcBatchProvider extends ethers.providers.JsonRpcBatchProvider {
  detectNetwork = ethers.providers.StaticJsonRpcProvider.prototype.detectNetwork.bind(this)
}

export class TenderlyRpcProvider extends ethers.providers.JsonRpcProvider {
  override send(method: string, params: Array<unknown>): Promise<unknown> {
    return retry(() => super.send(method, params))
  }
}

type FallthroughProviderOptions = {
  excludeWalletProvider?: boolean
  onError?: (error: Error) => void
}

export class FallthroughProvider extends ethers.providers.BaseProvider {
  detectNetwork = ethers.providers.StaticJsonRpcProvider.prototype.detectNetwork.bind(this)
  badRpcsLastCall: Record<string, number> = {}
  _providers: ethers.providers.JsonRpcProvider[] = []
  _walletProvider?: ethers.providers.Web3Provider
  customProvider: ethers.providers.JsonRpcProvider | undefined = undefined

  constructor(
    defaultProviders: ethers.providers.JsonRpcProvider[],
    network: Networkish | Promise<Network>,
    private readonly options: FallthroughProviderOptions = {}
  ) {
    super(network)
    this._providers = defaultProviders
    makeObservable(this, {
      _providers: observable,
      _walletProvider: observable,
      customProvider: observable,
      ok: computed,
    })
  }

  setCustomProvider(provider?: ethers.providers.JsonRpcProvider): void {
    runInAction(() => {
      this.customProvider = provider
    })
  }

  setWalletProvider(provider?: ethers.providers.Web3Provider): void {
    this._walletProvider = provider
  }

  get ok(): boolean {
    return this.customProvider !== undefined || this.okProviders.length > 0
  }

  get providers(): ethers.providers.JsonRpcProvider[] {
    return this._walletProvider && !this.options.excludeWalletProvider
      ? [this._walletProvider, ...this._providers]
      : this._providers
  }

  get okProviders(): ethers.providers.JsonRpcProvider[] {
    // custom provider will override all other providers
    if (this.customProvider) return [this.customProvider]
    return this.providers.filter((provider) => {
      const lastCall = this.badRpcsLastCall[provider.connection.url]
      // filter out providers that failed in the last 10 seconds
      return lastCall === undefined || lastCall + 10 * SEC_IN_MS < Date.now()
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async perform(method: string, params: any): Promise<any> {
    const performs = this.okProviders.map((provider) => provider.perform(method, params))
    try {
      // trigger await here to catch errors
      const res = await Promise.any(performs)
      return res
    } catch (e) {
      // this catch block will only be reached if all RPCs failed
      // TODO: remove all toasts from individual calls, and toast one site wide error instead
      // alternatively, consider having an rpcFailed flag which triggers
      // a different UI when all RPCs are down (e.g. prompt user to add custom RPC)
      this.options.onError?.(e as Error)
      if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
        throw e
      }
      throw Error('No RPCs available at the moment.')
    } finally {
      // find failing rpcs and mark the time they failed
      const allResults = await Promise.allSettled(performs)
      allResults.forEach(({ status }, index) => {
        if (status === 'rejected') {
          const provider = this.providers[index]
          this.badRpcsLastCall[provider.connection.url] = Date.now()
        }
      })
    }
  }
}
