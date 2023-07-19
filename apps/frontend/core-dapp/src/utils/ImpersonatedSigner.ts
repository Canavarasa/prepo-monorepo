import { BigNumber, ethers, VoidSigner } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'
import { TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider'

export class ImpersonatedSigner extends VoidSigner {
  constructor(address: string, private readonly _provider: ethers.providers.JsonRpcProvider) {
    super(address, _provider)
  }

  override async sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse> {
    const tx = await this.populateTransaction(transaction)

    if (
      tx.nonce === undefined ||
      tx.chainId === undefined ||
      tx.gasLimit === undefined ||
      tx.maxFeePerGas === undefined ||
      tx.maxPriorityFeePerGas === undefined
    )
      throw new Error('Missing tx data')

    const hash = await this._provider.send('eth_sendTransaction', [
      {
        chainId: tx.chainId,
        data: tx.data,
        from: this.address,
        gasLimit: ethers.utils.hexValue(tx.gasLimit),
        maxFeePerGas: ethers.utils.hexValue(tx.maxFeePerGas),
        maxPriorityFeePerGas: ethers.utils.hexValue(tx.maxPriorityFeePerGas),
        to: tx.to,
        type: tx.type,
        value: ethers.utils.hexValue(tx.value ?? 0),
      },
    ])

    return {
      chainId: tx.chainId,
      confirmations: 0,
      data: '',
      from: this.address,
      gasLimit: BigNumber.from(tx.gasLimit ?? 0),
      hash,
      nonce: BigNumber.from(tx.nonce).toNumber(),
      value: BigNumber.from(0),
      wait: () => this._provider.waitForTransaction(hash),
    }
  }
}
