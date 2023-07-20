import { Factory, ContractReturn } from 'prepo-stores'
import { BigNumber, ethers, Signature } from 'ethers'
import { splitSignature } from 'ethers/lib/utils'
import { computed, makeObservable, observable } from 'mobx'
import { Erc20Store } from './Erc20.entity'
import { RootStore } from '../RootStore'
import { SupportedContractsNames } from '../../lib/contract.types'
import { Erc20permitAbi } from '../../../generated/typechain'
import { Permit } from '../../lib/other-interfaces'

type Name = Erc20permitAbi['functions']['name']
type Nonces = Erc20permitAbi['functions']['nonces']

type Constructor = {
  root: RootStore
  tokenName: SupportedContractsNames
  symbolOverride?: string
  factory?: Factory
}

export type SignedPermit = Pick<Signature, 'r' | 'v' | 's'> & {
  deadline: number
}

export class Erc20PermitStore extends Erc20Store {
  constructor({ factory, root, symbolOverride, tokenName }: Constructor) {
    super({
      factory,
      root,
      symbolOverride,
      tokenName,
    })
    makeObservable<Erc20PermitStore, 'getName' | 'name' | 'nonces' | 'signerNonces'>(this, {
      getName: observable,
      name: computed,
      nonces: observable,
      permitReady: computed,
      signerNonces: computed,
    })
  }

  private getName(...params: Parameters<Name>): ContractReturn<Name> {
    return this.call<Name>('name', params)
  }

  private nonces(...params: Parameters<Nonces>): ContractReturn<Nonces> {
    return this.call<Nonces>('nonces', params)
  }

  private get name(): string | undefined {
    return this.getName()?.[0]
  }

  private get signerNonces(): BigNumber | undefined {
    const { address } = this.root.web3Store
    if (!address) return undefined
    return this.nonces(address)?.[0]
  }

  get permitReady(): boolean {
    return this.name !== undefined && this.signerNonces !== undefined
  }

  async getPermitSignature(
    spender: string,
    value: BigNumber,
    deadline: number
  ): Promise<Signature | string> {
    const { address: verifyingContract, name, signerNonces: nonce } = this
    const { address: owner, signer, network } = this.root.web3Store
    if (nonce === undefined || !verifyingContract || !name || !owner || !signer)
      return 'Please try again shortly.'

    return splitSignature(
      await signer?._signTypedData(
        {
          name,
          version: '1',
          chainId: network.chainId,
          verifyingContract,
        },
        { Permit },
        {
          owner,
          spender,
          value,
          nonce,
          deadline,
        }
      )
    )
  }

  static readonly EMPTY_PERMIT: SignedPermit = {
    deadline: 0,
    v: 0,
    r: ethers.constants.HashZero,
    s: ethers.constants.HashZero,
  }
}
