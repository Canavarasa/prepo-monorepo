import { BigNumber, utils } from 'ethers'
import { validateStringToBN } from './validateStringToBN'

/**
 * @returns BigNumber if input is valid and decimals is loaded
 * @description Safely converts any string or number to BigNumber without risk of throwing run time error
 */
export const parseUnits = (value: string, decimals: number | undefined): BigNumber | undefined => {
  // loading decimals of ERC20 token
  if (decimals === undefined) return undefined

  let valueString = value

  // prevent ether's parseUnits from throwing error during runtime
  // when parsing non number input
  if (!validateStringToBN(valueString)) return undefined

  if (valueString === '') return BigNumber.from(0)

  const [significantPart, fractionPart] = valueString.split('.')

  // cap fraction part within `decimals` (not rounded up) because
  // ether's parseUnits will throw runtime error if string has longer fraction than `decimals`
  if (fractionPart && fractionPart.length > decimals)
    valueString = `${significantPart}.${fractionPart.substring(0, decimals)}`

  // convert string to BigNumber
  return utils.parseUnits(valueString, decimals)
}
