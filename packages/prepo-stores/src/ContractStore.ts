import { ContractCallContext } from 'ethereum-multicall'
import { action, autorun, makeObservable, observable, onBecomeUnobserved, runInAction } from 'mobx'
import { Contract, ContractFunction, BigNumber, UnsignedTransaction, ethers } from 'ethers'
import { getContractAddress } from 'prepo-utils'
import { RootStore } from './RootStore'
import { isImportantError } from './utils/error-capturer-util'
import { Abi, ContractReturn, Factory, Storage, TransactionReceipt } from './utils/stores.types'
import { DYNAMIC_CONTRACT_ADDRESS, ZERO_ADDRESS } from './utils/constants'
import { SendTransactionReturn } from './types'

export type CallOptions = {
  subscribe: boolean
}

type SendTransactionOptions = {
  minimumGasLimit?: BigNumber
} & UnsignedTransaction

type GasOptions = { gasLimit?: BigNumber }

export async function generateGasOptions(
  signer: ethers.Signer,
  unsignedTransaction: UnsignedTransaction
): Promise<GasOptions> {
  const options: GasOptions = {}

  try {
    const gasLimitEstimate = await signer.estimateGas({
      ...unsignedTransaction,
      type: 2,
    })
    options.gasLimit = gasLimitEstimate.mul(2)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Gas estimation failed.')
  }

  return options
}

export class ContractStore<RootStoreType, SupportedContracts> {
  contractName: keyof SupportedContracts
  address?: string
  root: RootStore<SupportedContracts> & RootStoreType
  contract?: Contract
  abi: Abi
  factory: Factory
  storage: Storage
  called: Storage

  constructor(
    root: RootStore<SupportedContracts> & RootStoreType,
    /* make sure contractName is unique across application or multicall will be confused */
    contractName: keyof SupportedContracts,
    factory: Factory
  ) {
    this.root = root
    this.contract = undefined
    this.contractName = contractName
    this.factory = factory
    this.abi = factory.abi
    this.storage = {}
    this.called = {}
    makeObservable(this, {
      storage: observable,
      init: action,
      call: observable,
      contract: observable,
      sendTransaction: observable,
      getWriteContract: action,
      generateGasOptions: action,
    })
    this.init()
  }

  init(): void {
    autorun(() => {
      const network = this.root.web3Store.network.name
      const address = getContractAddress<SupportedContracts>(
        this.contractName,
        network,
        this.root.config.supportedContracts
      )
      if (address === DYNAMIC_CONTRACT_ADDRESS) return
      if (typeof address === 'undefined')
        throw Error(`no address for ${this.contractName as string} on ${network}`)
      this.address = address
      this.contract = this.factory.connect(this.address, this.root.web3Store.coreProvider)
    })
  }

  // for initializing contract stores which address could be retrieved dynamically
  updateAddress(newAddress: string): void {
    if (newAddress !== this.contract?.address) {
      runInAction(() => {
        this.address = newAddress
        this.contract = this.factory.connect(this.address, this.root.web3Store.coreProvider)
      })
    }
  }

  async sendTransaction<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    callerOptions: SendTransactionOptions = {}
  ): Promise<SendTransactionReturn> {
    // Separate custom options
    const { minimumGasLimit, ...unsignedTransaction } = callerOptions

    // Estimate gasLimit and build tx options
    const gasOptions = await this.generateGasOptions(methodName, params, unsignedTransaction)

    // Make sure gasLimit is never lower than minimumGasLimit
    if (
      minimumGasLimit !== undefined &&
      (!gasOptions.gasLimit || gasOptions.gasLimit.lt(minimumGasLimit))
    ) {
      gasOptions.gasLimit = minimumGasLimit
    }

    const options = { ...gasOptions, ...unsignedTransaction }

    // Craft and send the tx with the signer
    const writeContract = this.getWriteContract()
    try {
      const { hash } = await writeContract[methodName](...params, options)

      // Wait for tx to resolve with the coreProvider (signer can be seconds slower than coreProvider)
      return { hash, wait: (): Promise<TransactionReceipt> => this.root.web3Store.wait(hash) }
    } catch (error) {
      throw this.root.captureError(error)
    }
  }

  getWriteContract(): Contract {
    if (!this.contract || !this.root.web3Store.signer || !this.address)
      throw Error('contract not initialized or no signer')
    return this.factory.connect(this.address, this.root.web3Store.signer)
  }

  generateGasOptions<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    callerOptions: UnsignedTransaction = {}
  ): Promise<GasOptions> {
    if (!this.contract) throw Error('contract not initialized')
    if (!this.root.web3Store.signer) throw Error('wallet not connected')

    return generateGasOptions(this.root.web3Store.signer, {
      data: this.contract.interface.encodeFunctionData(methodName, params),
      to: this.contract.address,
      ...callerOptions,
    })
  }

  call<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    options: CallOptions = { subscribe: true }
  ): ContractReturn<T> | undefined {
    try {
      const paramStr = JSON.stringify(params)

      // Init storageProperty if required
      runInAction(() => {
        if (!this.storage[methodName]) this.storage[methodName] = {}
      })

      // If cached, return cached
      const cur = this.storage[methodName][paramStr]
      if (cur !== undefined) return cur

      // Logic to execute after we get the initial value
      const onFirstSet = (res: ContractReturn<T>): void => {
        runInAction(() => {
          // Set the value
          this.storage[methodName][paramStr] = res

          if (options.subscribe) {
            // Automatically get updates for this value with the multicall,
            // and set up removing the call when this call becomes unobserved
            if (!this.address)
              throw Error(`contract ${this.contractName as string} not initialized`)
            const call: ContractCallContext = {
              reference: this.contractName as string,
              contractAddress: this.address,
              abi: this.abi,
              calls: [{ reference: methodName, methodName, methodParameters: params }],
              context: {
                contractStore: this,
              },
            }
            this.root.multicallStore.addCall(call)
            onBecomeUnobserved(this.storage[methodName], paramStr, () => {
              runInAction(() => {
                this.root.multicallStore.removeCall(call)
                delete this.storage[methodName][paramStr]
                delete this.called[methodName][paramStr]
              })
            })
          }
        })
      }

      if (
        this.contract &&
        // listen to changes on these to recover from failing RPCs
        (this.root.web3Store.coreProvider.customProvider || this.root.web3Store.coreProvider.ok)
      ) {
        if (this.address === ZERO_ADDRESS) return undefined

        // Make first call to SC to get the value
        runInAction((): void => {
          if (this.called[methodName] === undefined) this.called[methodName] = {}
          // only make call if method and it's set of params hasn't been cached
          // this is because mobx will instantly trigger calls with undefined values when something is changed
          // for example, if we try to send 100 calls and one of them returns faster than the other
          // the other 99 would still be in undefined state, hence not having this called check will cause these calls
          // that have been called to be called again
          if (!this.called[methodName][paramStr]) {
            // instantly cache a function before it's called to avoid redundant call
            this.called[methodName][paramStr] = true
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.contract.functions[methodName](...params)
              .then(onFirstSet)
              .catch((error) => {
                this.called[methodName][paramStr] = false
                if (isImportantError(error) && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production')
                  throw this.root.captureError(error)
              })
          }
        })
      }
      return undefined
    } catch (error) {
      // read values don't handle errors very well (e.g. might toast 1 error message per call per block, flooding the screen with error toasts)
      // An error is usually thrown here if:
      // - there is programming error (e.g. calling method that doesn't exist) - code should not be released to prod
      // - all RPCs are down - should just toast 1 error from Web3Store
      //
      // this should only throw in dev env to help with development and never in prod
      if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') throw this.root.captureError(error)
      return undefined
    }
  }
}
