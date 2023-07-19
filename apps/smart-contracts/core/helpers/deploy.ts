import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {
  deployNonUpgradeableContract,
  includeIfNotIncluded,
  setSingleValueIfNotAlreadySet,
} from 'prepo-hardhat'
import { ExtendedMarketHook, ExtendedTokenSender } from '../types'
import { AccountList, TokenSender } from '../types/generated'

export async function deployTokenSenderAndPeriphery(
  hre: HardhatRuntimeEnvironment,
  tokenSenderName: string,
  rewardTokenAddress: string,
  rewardTokenDecimals: number,
  twapPriceAddress: string
): Promise<ExtendedTokenSender> {
  const tokenSender: ExtendedTokenSender = (await deployNonUpgradeableContract(
    'TokenSender',
    tokenSenderName,
    [rewardTokenAddress, rewardTokenDecimals],
    hre
  )) as TokenSender
  tokenSender.allowedMsgSenders = (await deployNonUpgradeableContract(
    'AccountList',
    `${tokenSenderName}-AllowedMsgSenders`,
    [],
    hre
  )) as AccountList
  tokenSender.twapPrice = await hre.ethers.getContractAt(
    'UniswapV3OracleUintValue',
    twapPriceAddress
  )
  return tokenSender
}

export async function configureTokenSenderViaSigner(
  signer: SignerWithAddress,
  tokenSender: ExtendedTokenSender,
  options: {
    priceMultiplier?: BigNumber | number
    scaledPriceLowerBound?: BigNumber | number
    allowedMsgSenders?: string[]
  } = {}
): Promise<void> {
  await setSingleValueIfNotAlreadySet(
    signer,
    tokenSender,
    tokenSender.twapPrice.address,
    'getPrice',
    'setPrice'
  )
  await setSingleValueIfNotAlreadySet(
    signer,
    tokenSender,
    tokenSender.allowedMsgSenders.address,
    'getAllowedMsgSenders',
    'setAllowedMsgSenders'
  )
  if (options.priceMultiplier !== undefined)
    await setSingleValueIfNotAlreadySet(
      signer,
      tokenSender,
      options.priceMultiplier,
      'getPriceMultiplier',
      'setPriceMultiplier'
    )
  if (options.scaledPriceLowerBound !== undefined)
    await setSingleValueIfNotAlreadySet(
      signer,
      tokenSender,
      options.scaledPriceLowerBound,
      'getScaledPriceLowerBound',
      'setScaledPriceLowerBound'
    )
  if (options.allowedMsgSenders !== undefined && options.allowedMsgSenders.length > 0) {
    await includeIfNotIncluded(signer, tokenSender.allowedMsgSenders, options.allowedMsgSenders)
  }
}

export async function deployMarketHookAndPeriphery(
  hre: HardhatRuntimeEnvironment,
  marketNameSuffix: string, // e.g. 'Arbitrum ($5-25B)'
  hookName: string, // e.g. 'MintHook' or 'RedeemHook'
  options: {
    allowedMsgSendersAddress?: string
    bypasslistAddress?: string
    tokenSender?: ExtendedTokenSender
  } = {}
): Promise<ExtendedMarketHook> {
  const { ethers } = hre
  const hookDeploymentName = `${marketNameSuffix}-${hookName}`
  await deployNonUpgradeableContract(`MarketHook`, hookDeploymentName, [], hre)
  const hook: ExtendedMarketHook = await ethers.getContract(hookDeploymentName)
  if (options.allowedMsgSendersAddress === undefined) {
    hook.allowedMsgSenders = (await deployNonUpgradeableContract(
      'AccountList',
      `${hookDeploymentName}-AllowedMsgSenders`,
      [],
      hre
    )) as AccountList
  } else
    hook.allowedMsgSenders = await ethers.getContractAt(
      'AccountList',
      options.allowedMsgSendersAddress
    )
  if (options.bypasslistAddress === undefined) {
    hook.bypasslist = (await deployNonUpgradeableContract(
      'AccountList',
      `${hookDeploymentName}-Bypasslist`,
      [],
      hre
    )) as AccountList
  } else hook.bypasslist = await ethers.getContractAt('AccountList', options.bypasslistAddress)
  hook.tokenSender = options.tokenSender
  return hook
}

export async function configureMarketHookViaSigner(
  signer: SignerWithAddress,
  hook: ExtendedMarketHook,
  marketAddress: string,
  treasuryAddress: string
): Promise<void> {
  await includeIfNotIncluded(signer, hook.allowedMsgSenders, [marketAddress])
  await setSingleValueIfNotAlreadySet(
    signer,
    hook,
    hook.allowedMsgSenders.address,
    'getAllowedMsgSenders',
    'setAllowedMsgSenders'
  )
  await setSingleValueIfNotAlreadySet(
    signer,
    hook,
    hook.bypasslist.address,
    'getAccountList',
    'setAccountList'
  )
  await setSingleValueIfNotAlreadySet(signer, hook, treasuryAddress, 'getTreasury', 'setTreasury')
  await setSingleValueIfNotAlreadySet(
    signer,
    hook,
    hook.tokenSender.address,
    'getTokenSender',
    'setTokenSender'
  )
}
