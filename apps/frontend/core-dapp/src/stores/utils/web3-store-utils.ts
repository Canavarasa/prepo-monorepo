import { BigNumber } from 'ethers'

export const getContractCall = (rawValueFromSC: [BigNumber] | undefined): BigNumber | undefined => {
  if (rawValueFromSC === undefined) return undefined
  return rawValueFromSC[0]
}
