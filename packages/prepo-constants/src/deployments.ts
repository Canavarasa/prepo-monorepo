export const DEPLOYMENT_NAMES = {
  ppo: {
    name: 'PPO',
    restrictedTransferHook: {
      name: 'PPO-RestrictedTransferHook',
      blocklist: {
        name: 'PPO-RestrictedTransferHook-Blocklist',
      },
      sourceAllowlist: {
        name: 'PPO-RestrictedTransferHook-SourceAllowlist',
      },
      destinationAllowlist: {
        name: 'PPO-RestrictedTransferHook-DestinationAllowlist',
      },
    },
  },
  miniSales_permissioned: {
    name: 'MiniSales_Permissioned',
    allowlistPurchaseHook: {
      name: 'MiniSales_Permissioned-AllowlistPurchaseHook',
      allowlist: {
        name: 'MiniSales_Permissioned-AllowlistPurchaseHook-Allowlist',
      },
    },
  },
  miniSales_public: {
    name: 'MiniSales_Public',
  },
  vesting: {
    name: 'Vesting',
  },
  miniSalesFlag: {
    name: 'MiniSalesFlag',
  },
  preUSDC: {
    name: 'preUSDC',
    depositHook: {
      name: 'preUSDC-DepositHook',
      depositRecord: {
        name: 'preUSDC-DepositRecord',
      },
      tokenSender: {
        name: 'PPOTokenSender',
      },
    },
    withdrawHook: {
      name: 'preUSDC-WithdrawHook',
      depositRecord: {
        name: 'preUSDC-DepositRecord',
      },
      tokenSender: {
        name: 'PPOTokenSender',
      },
    },
    depositRecord: {
      name: 'preUSDC-DepositRecord',
      allowedMsgSenders: {
        name: 'preUSDC-DepositRecord-AllowedMsgSenders',
      },
      bypasslist: {
        name: 'preUSDC-DepositRecord-Bypasslist',
      },
    },
  },
  preWstETH: {
    name: 'preWstETH',
    depositHook: {
      name: 'preWstETH-DepositHook',
      depositRecord: {
        name: 'preWstETH-DepositRecord',
      },
      tokenSender: {
        name: 'preWstETH-DepositHook-PPOTokenSender',
        allowedMsgSenders: {
          name: 'preWstETH-DepositHook-PPOTokenSender-AllowedMsgSenders',
        },
        twapPrice: {
          name: 'UniswapV3OracleUintValue-PPO-USDC-ETH',
        },
      },
    },
    withdrawHook: {
      name: 'preWstETH-WithdrawHook',
      depositRecord: {
        name: 'preWstETH-DepositRecord',
      },
      tokenSender: {
        name: 'preWstETH-WithdrawHook-PPOTokenSender',
        allowedMsgSenders: {
          name: 'preWstETH-WithdrawHook-PPOTokenSender-AllowedMsgSenders',
        },
        twapPrice: {
          name: 'UniswapV3OracleUintValue-PPO-USDC-ETH',
        },
      },
    },
    depositRecord: {
      name: 'preWstETH-DepositRecord',
      allowedMsgSenders: {
        name: 'preWstETH-DepositRecord-AllowedMsgSenders',
      },
      bypasslist: {
        name: 'preWstETH-DepositRecord-Bypasslist',
      },
    },
  },
  depositTradeHelper: {
    name: 'DepositTradeHelper',
    tokenSender: {
      name: 'DepositTradeHelper-PPOTokenSender',
      allowedMsgSenders: {
        name: 'DepositTradeHelper-PPOTokenSender-AllowedMsgSenders',
      },
      twapPrice: {
        name: 'UniswapV3OracleUintValue-PPO-USDC-ETH',
      },
    },
  },
  arbitrageBroker: {
    name: 'ArbitrageBroker',
  },
  prePOMarketFactory: {
    name: 'PrePOMarketFactory',
  },
  uniswapV3Oracle: {
    name: 'UniswapV3Oracle',
  },
  ppoUSDCtoETHOracle: {
    name: 'UniswapV3OracleUintValue-PPO-USDC-ETH',
  },
} as const

export type DeploymentNames = typeof DEPLOYMENT_NAMES
