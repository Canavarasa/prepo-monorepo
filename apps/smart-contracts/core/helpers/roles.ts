import { MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ProposalStep } from 'defender-admin-client/lib/models/proposal'
import * as roleConstants from 'prepo-constants/src/roles'
import { utils } from 'prepo-hardhat'
import { DEFAULT_ADMIN_ROLE, Network } from 'prepo-constants'
import {
  ArbitrageBroker,
  Collateral,
  DepositHook,
  DepositRecord,
  PrePOMarket,
  PrePOMarketFactory,
  TokenSender,
  WithdrawHook,
} from '../types/generated'

const { batchGrantAndAcceptRoles, batchGrantRoles, getAcceptRoleSteps, getRevokeRoleSteps } = utils

async function assignCollateralRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  collateral: Collateral | MockContract<Collateral>
): Promise<void> {
  await batchGrantAndAcceptRoles(collateral, rootAdmin, nominee, roleConstants.COLLATERAL_ROLES)
}

async function assignDepositRecordRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  await batchGrantAndAcceptRoles(
    depositRecord,
    rootAdmin,
    nominee,
    roleConstants.DEPOSIT_RECORD_ROLES
  )
}

async function assignDepositHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  depositHook: DepositHook | MockContract<DepositHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(depositHook, rootAdmin, nominee, roleConstants.DEPOSIT_HOOK_ROLES)
}

async function assignWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): Promise<void> {
  await batchGrantAndAcceptRoles(
    withdrawHook,
    rootAdmin,
    nominee,
    roleConstants.WITHDRAW_HOOK_ROLES
  )
}

async function assignTokenSenderRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  tokenSender: TokenSender | MockContract<TokenSender>
): Promise<void> {
  await batchGrantAndAcceptRoles(tokenSender, rootAdmin, nominee, roleConstants.TOKEN_SENDER_ROLES)
}

async function assignPrePOMarketFactoryRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  prePOMarketFactory: PrePOMarketFactory
): Promise<void> {
  await batchGrantAndAcceptRoles(
    prePOMarketFactory,
    rootAdmin,
    nominee,
    roleConstants.PREPO_MARKET_FACTORY_ROLES
  )
}

async function assignPrePOMarketRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  prePOMarket: PrePOMarket
): Promise<void> {
  await batchGrantAndAcceptRoles(prePOMarket, rootAdmin, nominee, roleConstants.PREPO_MARKET_ROLES)
}

async function assignArbitrageBrokerRoles(
  rootAdmin: SignerWithAddress,
  nominee: SignerWithAddress,
  arbitrageBroker: ArbitrageBroker
): Promise<void> {
  await batchGrantAndAcceptRoles(
    arbitrageBroker,
    rootAdmin,
    nominee,
    roleConstants.ARBITRAGE_BROKER_ROLES
  )
}

async function grantCollateralRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  collateral: Collateral | MockContract<Collateral>
): Promise<void> {
  await batchGrantRoles(
    collateral,
    rootAdmin,
    nomineeAddress,
    roleConstants.COLLATERAL_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantDepositRecordRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): Promise<void> {
  await batchGrantRoles(
    depositRecord,
    rootAdmin,
    nomineeAddress,
    roleConstants.DEPOSIT_RECORD_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantDepositHookRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  depositHook: DepositHook | MockContract<DepositHook>
): Promise<void> {
  await batchGrantRoles(
    depositHook,
    rootAdmin,
    nomineeAddress,
    roleConstants.DEPOSIT_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantWithdrawHookRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): Promise<void> {
  await batchGrantRoles(
    withdrawHook,
    rootAdmin,
    nomineeAddress,
    roleConstants.WITHDRAW_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantTokenSenderRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  tokenSender: TokenSender | MockContract<TokenSender>
): Promise<void> {
  await batchGrantRoles(
    tokenSender,
    rootAdmin,
    nomineeAddress,
    roleConstants.TOKEN_SENDER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantPrePOMarketFactoryRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  prePOMarketFactory: PrePOMarketFactory
): Promise<void> {
  await batchGrantRoles(
    prePOMarketFactory,
    rootAdmin,
    nomineeAddress,
    roleConstants.PREPO_MARKET_FACTORY_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

async function grantArbitrageBrokerRoles(
  rootAdmin: SignerWithAddress,
  nomineeAddress: string,
  arbitrageBroker: ArbitrageBroker
): Promise<void> {
  await batchGrantRoles(
    arbitrageBroker,
    rootAdmin,
    nomineeAddress,
    roleConstants.ARBITRAGE_BROKER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getCollateralAcceptRoleSteps(
  network: Network,
  collateral: Collateral | MockContract<Collateral>
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    collateral,
    roleConstants.COLLATERAL_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getDepositRecordAcceptRoleSteps(
  network: Network,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    depositRecord,
    roleConstants.DEPOSIT_RECORD_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getDepositHookAcceptRoleSteps(
  network: Network,
  depositHook: DepositHook | MockContract<DepositHook>
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    depositHook,
    roleConstants.DEPOSIT_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getWithdrawHookAcceptRoleSteps(
  network: Network,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    withdrawHook,
    roleConstants.WITHDRAW_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getTokenSenderAcceptRoleSteps(
  network: Network,
  tokenSender: TokenSender | MockContract<TokenSender>
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    tokenSender,
    roleConstants.TOKEN_SENDER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getPrePOMarketFactoryAcceptRoleSteps(
  network: Network,
  prePOMarketFactory: PrePOMarketFactory
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    prePOMarketFactory,
    roleConstants.PREPO_MARKET_FACTORY_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getArbitrageBrokerAcceptRoleSteps(
  network: Network,
  arbitrageBroker: ArbitrageBroker
): ProposalStep[] {
  return getAcceptRoleSteps(
    network,
    arbitrageBroker,
    roleConstants.ARBITRAGE_BROKER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getCollateralRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  collateral: Collateral | MockContract<Collateral>
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    collateral,
    roleConstants.COLLATERAL_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getDepositRecordRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  depositRecord: DepositRecord | MockContract<DepositRecord>
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    depositRecord,
    roleConstants.DEPOSIT_RECORD_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getDepositHookRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  depositHook: DepositHook | MockContract<DepositHook>
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    depositHook,
    roleConstants.DEPOSIT_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getWithdrawHookRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  withdrawHook: WithdrawHook | MockContract<WithdrawHook>
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    withdrawHook,
    roleConstants.WITHDRAW_HOOK_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getTokenSenderRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  tokenSender: TokenSender | MockContract<TokenSender>
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    tokenSender,
    roleConstants.TOKEN_SENDER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getPrePOMarketFactoryRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  prePOMarketFactory: PrePOMarketFactory
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    prePOMarketFactory,
    roleConstants.PREPO_MARKET_FACTORY_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

function getArbitrageBrokerRevokeRoleSteps(
  network: Network,
  roleHolderAddress: string,
  arbitrageBroker: ArbitrageBroker
): ProposalStep[] {
  return getRevokeRoleSteps(
    network,
    roleHolderAddress,
    arbitrageBroker,
    roleConstants.ARBITRAGE_BROKER_ROLES.concat(DEFAULT_ADMIN_ROLE)
  )
}

export const roleAssigners = {
  assignCollateralRoles,
  assignDepositRecordRoles,
  assignDepositHookRoles,
  assignWithdrawHookRoles,
  assignTokenSenderRoles,
  assignPrePOMarketFactoryRoles,
  assignPrePOMarketRoles,
  assignArbitrageBrokerRoles,
}

export const roleGranters = {
  grantCollateralRoles,
  grantDepositRecordRoles,
  grantDepositHookRoles,
  grantWithdrawHookRoles,
  grantTokenSenderRoles,
  grantPrePOMarketFactoryRoles,
  grantArbitrageBrokerRoles,
}

export const roleProposalStepGetters = {
  getCollateralAcceptRoleSteps,
  getDepositRecordAcceptRoleSteps,
  getDepositHookAcceptRoleSteps,
  getWithdrawHookAcceptRoleSteps,
  getTokenSenderAcceptRoleSteps,
  getPrePOMarketFactoryAcceptRoleSteps,
  getArbitrageBrokerAcceptRoleSteps,
  getCollateralRevokeRoleSteps,
  getDepositRecordRevokeRoleSteps,
  getDepositHookRevokeRoleSteps,
  getWithdrawHookRevokeRoleSteps,
  getTokenSenderRevokeRoleSteps,
  getPrePOMarketFactoryRevokeRoleSteps,
  getArbitrageBrokerRevokeRoleSteps,
}
