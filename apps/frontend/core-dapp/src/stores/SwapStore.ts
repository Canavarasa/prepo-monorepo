import { BigNumber, ethers } from 'ethers'
import { makeAutoObservable } from 'mobx'
import { RootStore } from './RootStore'
import { UNISWAP_QUOTER_ADDRESS } from '../lib/external-contracts'
import QuoterABI from '../../abi/uniswapV3Quoter.abi.json'
import { debounce } from '../utils/debounce'

export type QuoteExactInputProps = {
  fromAddress: string
  toAddress: string
  amountBN: BigNumber
  fee: number
}

export class SwapStore {
  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  quoteExactInput = debounce(
    async ({
      amountBN,
      fromAddress,
      toAddress,
      fee,
    }: QuoteExactInputProps): Promise<
      { cachedInAmount: BigNumber; output: BigNumber } | undefined
    > => {
      if (amountBN.eq(0)) return { cachedInAmount: amountBN, output: BigNumber.from(0) }

      const quoterContract = new ethers.Contract(
        UNISWAP_QUOTER_ADDRESS.mainnet ?? '', // all uniswap contracts has same address on all chains
        QuoterABI,
        this.root.web3Store.coreProvider
      )

      const cachedInAmount = amountBN
      const sqrtPriceLimitX96 = 0 // The price limit of the pool that cannot be exceeded by the swap
      try {
        const output = await quoterContract.callStatic.quoteExactInputSingle(
          fromAddress,
          toAddress,
          fee,
          amountBN,
          sqrtPriceLimitX96
        )

        return { cachedInAmount, output }
      } catch (e) {
        return undefined
      }
    },
    600
  )
}
