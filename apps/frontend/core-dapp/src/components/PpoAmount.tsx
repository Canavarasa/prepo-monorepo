import { Icon, spacingIncrement } from 'prepo-ui'
import negate from 'lodash/fp/negate'
import styled from 'styled-components'
import React from 'react'
import Skeleton from './Skeleton'

const Wrapper = styled.div<{ $gap: number }>`
  align-items: center;
  display: flex;
  gap: ${({ $gap }): string => spacingIncrement($gap)};
  justify-content: center;
`

const Amount = styled.p`
  color: ${({ theme }): string => theme.color.primaryLight};
  white-space: nowrap;
`

const isSign = (part: Intl.NumberFormatPart): boolean =>
  part.type === 'plusSign' || part.type === 'minusSign'
const isNotSign = negate(isSign)

const PpoAmount: React.FC<{
  amount: string | undefined
  iconSize?: string
  iconSpacing?: number
  loading?: boolean
  signDisplay?: 'exceptZero' | 'never'
}> = ({
  amount,
  iconSize = '12',
  iconSpacing = 2,
  loading = false,
  signDisplay = 'exceptZero',
}) => {
  let signCharacter
  let amountCharacters

  if (typeof amount === 'string' && +amount < 0.01 && +amount > 0) {
    signCharacter = signDisplay === 'exceptZero' ? '+' : ''
    amountCharacters = '<0.01'
  } else {
    const parts = Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 1,
      notation: 'compact',
      signDisplay,
    }).formatToParts(+(amount ?? '0'))

    signCharacter = parts.find(isSign)?.value
    amountCharacters = parts
      .filter(isNotSign)
      .map(({ value }) => value)
      .join('')
  }

  return (
    <Wrapper className="ppo-amount" $gap={iconSpacing}>
      {signCharacter && <Amount>{signCharacter}</Amount>}
      <Icon name="ppo-logo" height={iconSize} width={iconSize} />
      {loading ? <Skeleton height={34} width={100} /> : <Amount>{amountCharacters}</Amount>}
    </Wrapper>
  )
}

export default PpoAmount
