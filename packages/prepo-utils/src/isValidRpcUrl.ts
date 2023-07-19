import { ethers } from 'ethers'
import { ChainId } from 'prepo-constants'

export const isValidRpcUrl = async (chainId: ChainId, url: string): Promise<boolean> => {
  const provider = new ethers.providers.JsonRpcProvider(url)
  const network = await provider.getNetwork()
  return network.chainId === chainId
}
