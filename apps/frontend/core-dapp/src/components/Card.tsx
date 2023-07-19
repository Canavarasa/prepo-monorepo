import type { CardProps } from 'antd'
import styled from 'styled-components'
import { centered, spacingIncrement } from 'prepo-ui'
import { ComponentType } from 'react'
import dynamic from 'next/dynamic'

const ACard: ComponentType<CardProps> = dynamic(() => import('antd').then(({ Card }) => Card))

const Wrapper = styled.div`
  width: 100%;
  &&& {
    ${centered};
    border-radius: ${({ theme }): string => theme.borderRadius.lg};
    .ant-card {
      background-color: ${({ theme }): string => theme.color.neutral10};
      box-shadow: 0px 4px 22px rgba(98, 100, 216, 0.11);
      border-radius: inherit;
      border: unset;
    }
    .ant-card-body {
      border-radius: inherit;
      padding: ${spacingIncrement(16)};
    }
  }
`

const Card: React.FC<CardProps> = ({ ...props }) => {
  const component = (
    <Wrapper>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <ACard {...props} />
    </Wrapper>
  )

  return component
}

export default Card
