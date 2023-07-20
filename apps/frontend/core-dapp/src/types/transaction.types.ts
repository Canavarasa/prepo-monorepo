import { UnsignedTransaction } from 'ethers'

export type TxOutput = { success: boolean; error?: string; hash?: string }
export type UnsignedTxOutput = { success: boolean; error?: string; tx?: UnsignedTransaction }
