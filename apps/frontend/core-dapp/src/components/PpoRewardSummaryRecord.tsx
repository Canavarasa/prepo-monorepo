import styled from 'styled-components'
import { FC } from 'react'
import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import { formatEther } from 'ethers/lib/utils'
import SummaryRecord from './SummaryRecord'
import PpoAmount from './PpoAmount'
import Skeleton from './Skeleton'
import { PPOReward as PPORewardDefinition } from '../features/definitions'
import { displayEth } from '../utils/number-utils'
import { PpoReward } from '../stores/entities/FeeEntity'
import { useRootStore } from '../context/RootStoreProvider'

const Wrapper = styled.div`
  column-gap: ${spacingIncrement(4)};
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
`

export const PPOReward: FC<{
  displayValueInEth?: boolean
  reward: PpoReward | undefined
}> = observer(({ displayValueInEth = true, reward }) => {
  const { ppoTokenStore } = useRootStore()

  const ppoReward = reward === undefined ? undefined : ppoTokenStore.formatUnits(reward.inPpo)

  if (reward === undefined || ppoReward === undefined) {
    return <Skeleton height="22px" width="64px" />
  }

  const ppoValue = +formatEther(reward.inEth)

  if (+ppoReward <= 0) {
    return null
  }

  return (
    <Wrapper>
      <PpoAmount amount={ppoReward} />
      {displayValueInEth && <p>({displayEth(ppoValue ?? 0)})</p>}
    </Wrapper>
  )
})

export const PPORewardSummaryRecord: FC<{
  label?: string
  reward: PpoReward | undefined
}> = ({ label = 'PPO Reward', reward }) => {
  if (reward !== undefined && reward.inPpo.eq(0)) {
    return null
  }

  return (
    <SummaryRecord label={label} tooltip={<PPORewardDefinition />}>
      <PPOReward reward={reward} />
    </SummaryRecord>
  )
}
