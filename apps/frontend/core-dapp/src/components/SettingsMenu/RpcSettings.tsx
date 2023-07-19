import { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Button, Flex, Icon, Input, Spinner, Tooltip, spacingIncrement } from 'prepo-ui'
import { isValidRpcUrl } from 'prepo-utils'
import styled from 'styled-components'
import SettingsMenuItem from './SettingsMenuItem'
import { useRootStore } from '../../context/RootStoreProvider'
import { useDebounce } from '../../hooks/useDebounce'

const FormWrapper = styled.div<{ $show: boolean }>`
  background-color: ${({ theme }): string => theme.color.neutral10};
  height: 100%;
  left: ${({ $show }): string => ($show ? '0' : '100%')};
  padding: ${spacingIncrement(16)};
  position: absolute;
  top: 0;
  transition: 0.2s;
  width: 100%;
`

const ArrowIconWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral2};
  cursor: pointer;
  :hover {
    opacity: 0.7;
  }
`

const Description = styled.p`
  color: ${({ theme }): string => theme.color.neutral3};
`

const Title = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const SuffixWrapper = styled.div`
  line-height: 1;
  margin-right: ${spacingIncrement(-4)};
  padding-left: ${spacingIncrement(2)};
`

const RpcSettings: React.FC<{ onSave: () => void }> = ({ onSave }) => {
  const { web3Store } = useRootStore()
  const { currentRpcUrl, network } = web3Store
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({})
  const [showForm, setShowForm] = useState(false)
  const [rpcUrl, setRpcUrl] = useState(currentRpcUrl ?? '')
  const debouncedRpcUrl = useDebounce(rpcUrl)

  const inputUnchanged = currentRpcUrl === rpcUrl || currentRpcUrl === debouncedRpcUrl
  const emptyImput = rpcUrl === '' || debouncedRpcUrl === ''
  const disabled = inputUnchanged || emptyImput || !status.ok
  const loading = status.ok === undefined && status.error === undefined
  const networkName = network.displayName ?? network.chainName

  const validateRpcUrl = useCallback(
    async (input) => {
      try {
        if (input === '') return
        // use URL to check if input is a valid url
        // eslint-disable-next-line no-new
        new URL(input)

        setStatus({})
        const valid = await isValidRpcUrl(network.chainId, input)

        setStatus(
          valid ? { ok: true } : { error: `The RPC does not match network ID of ${networkName}.` }
        )
      } catch (e) {
        if (e instanceof TypeError) {
          setStatus({ error: 'This is not a valid URL.' })
        } else {
          setStatus({ error: "Couldn't connect to the RPC server." })
        }
      }
    },
    [network, networkName]
  )

  useEffect(() => {
    validateRpcUrl(debouncedRpcUrl)
  }, [debouncedRpcUrl, validateRpcUrl])

  const handleSave = (): void => {
    web3Store.setRpcUrl(network.name, rpcUrl)
    onSave()
  }

  const handleDefaultRpc = (): void => {
    web3Store.setRpcUrl(network.name)
    onSave()
  }

  const statusIcon = (): React.ReactNode => {
    if (emptyImput) return null
    if (loading) return <Spinner size={12} color="neutral4" />
    if (status.ok)
      return (
        <Flex color="success">
          <Icon name="check" height="16" width="16" />
        </Flex>
      )
    if (status.error)
      return (
        <Flex color="error">
          <Tooltip overlay={status.error} placement="topRight">
            <Icon name="cross" height="16" width="16" />
          </Tooltip>
        </Flex>
      )
    return null
  }

  return (
    <>
      <SettingsMenuItem
        iconName="chevron-right"
        onClick={() => {
          setShowForm(true)
        }}
      >
        RPC Settings
      </SettingsMenuItem>
      <FormWrapper $show={showForm}>
        <Flex alignItems="center" justifyContent="flex-start" gap={8} mb={12}>
          <ArrowIconWrapper onClick={() => setShowForm(false)}>
            <Icon name="chevron-left" height="16" width="16" />
          </ArrowIconWrapper>
          <Title>RPC Settings</Title>
        </Flex>
        <Flex gap={8} flexDirection="column" width="100%" alignItems="flex-start">
          <Description>Enter custom RPC for {networkName}</Description>
          {/* Only render Input if form is shown so autoFocus works correctly */}
          {showForm && (
            <Input
              autoFocus
              size="small"
              placeholder="e.g. https://rpc.custom.com"
              value={rpcUrl}
              onChange={(e) => {
                setRpcUrl(e.target.value)
              }}
              suffix={<SuffixWrapper>{statusIcon()}</SuffixWrapper>}
            />
          )}
          <Button disabled={disabled} block size="sm" onClick={handleSave}>
            Save
          </Button>
          {currentRpcUrl !== undefined && (
            <Button block type="ghost" size="sm" onClick={handleDefaultRpc}>
              Use Default
            </Button>
          )}
        </Flex>
      </FormWrapper>
    </>
  )
}

export default observer(RpcSettings)
