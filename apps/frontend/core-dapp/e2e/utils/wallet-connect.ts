import { Core } from '@walletconnect/core'
import { Web3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet'
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'
import { BigNumber, ethers } from 'ethers'
import { NETWORKS, WALLETCONNECT_PROJECT_ID } from 'prepo-constants'
import { deferred } from '../../src/utils/deferred'
import { EventEmitter } from 'events'

const arbitrumChainId = NETWORKS.arbitrumOne.chainId

export async function connectMockWallet({
  wallet,
  walletConnectUri,
}: {
  wallet: ethers.Wallet
  walletConnectUri: string
}): Promise<{
  disconnect: () => Promise<void>
  provider: ethers.providers.JsonRpcProvider
  waitForTxHash: () => Promise<string>
}> {
  const core = new Core({
    projectId: WALLETCONNECT_PROJECT_ID,
  })

  const web3wallet = await Web3Wallet.init({
    core,
    metadata: {
      name: 'Mock Wallet',
      description: 'Mock Wallet for testing purposes only.',
      url: 'app.prepo.io',
      icons: [],
    },
  })

  const providerDeferred = deferred<ethers.providers.JsonRpcProvider>()
  const topicDeferred = deferred<string>()

  const txEvents = new EventEmitter()

  web3wallet.once('session_proposal', async (proposal) => {
    const session = await web3wallet.approveSession({
      id: proposal.id,
      namespaces: buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            chains: [`eip155:${arbitrumChainId}`],
            methods: [
              'eth_sendTransaction',
              'personal_sign',
              'eth_signTransaction',
              'eth_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
            ],
            events: ['chainChanged', 'accountsChanged'],
            accounts: [`eip155:${arbitrumChainId}:${wallet.address}`],
          },
        },
      }),
    })

    topicDeferred.setValue(session.topic)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcUrl: string = (session.requiredNamespaces.eip155 as any).rpcMap[
      arbitrumChainId.toString()
    ]
    providerDeferred.setValue(new ethers.providers.JsonRpcProvider(rpcUrl, arbitrumChainId))
  })

  const onSessionRequest = async (event: Web3WalletTypes.SessionRequest): Promise<void> => {
    const provider = await providerDeferred.asPromise
    const topic = await topicDeferred.asPromise

    const { params, id } = event
    const { request } = params

    if (request.method === 'eth_signTypedData_v4') {
      const [, payload] = request.params
      const { domain, types, message } = JSON.parse(payload)

      delete types.EIP712Domain // Ethers errors if we pass this
      const signed = await wallet._signTypedData(domain, types, message)
      const response = { id, result: signed, jsonrpc: '2.0' }
      await web3wallet.respondSessionRequest({ topic, response })
    } else if (request.method === 'eth_sendTransaction') {
      const txParams = request.params[0]
      const txBody = {
        chainId: arbitrumChainId,
        data: txParams.data,
        from: txParams.from,
        to: txParams.to,
        value: txParams.value,
      }

      const [gas, nonce, feeData] = await Promise.all([
        provider.estimateGas(txBody),
        provider.getTransactionCount(txBody.from),
        provider.getFeeData(),
      ])

      if (feeData.maxFeePerGas === null) {
        throw new Error('Missing fee data')
      }

      const signed = await wallet.signTransaction({
        ...txBody,
        gasLimit: gas.mul(11).div(10),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: BigNumber.from(0),
        type: 2,
        nonce,
      })
      const tx = await provider.sendTransaction(signed)

      txEvents.emit('tx:hash', tx.hash)

      const response = { id, result: tx.hash, jsonrpc: '2.0' }
      await web3wallet.respondSessionRequest({ topic, response })
    } else {
      throw new Error(`Unsupported method '${request.method}'`)
    }
  }

  web3wallet.on('session_request', onSessionRequest)

  await web3wallet.core.pairing.pair({
    uri: walletConnectUri,
  })

  return {
    disconnect: async () => {
      await web3wallet.disconnectSession({
        topic: await topicDeferred.asPromise,
        reason: getSdkError('USER_DISCONNECTED'),
      })

      web3wallet.removeListener('session_request', onSessionRequest)
    },
    provider: await providerDeferred.asPromise,
    waitForTxHash: () =>
      new Promise((resolve) => {
        txEvents.once('tx:hash', resolve)
      }),
  }
}
