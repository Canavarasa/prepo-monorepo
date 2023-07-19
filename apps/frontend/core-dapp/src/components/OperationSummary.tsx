import styled from 'styled-components'
import type { CollapseProps, CollapsePanelProps } from 'antd'
import { Flex, spacingIncrement } from 'prepo-ui'
import { ComponentType, ReactNode } from 'react'
import dynamic from 'next/dynamic'

const ACollapse: ComponentType<CollapseProps> = dynamic(() =>
  import('antd').then(({ Collapse }) => Collapse)
)

const ACollapsePanel: ComponentType<CollapsePanelProps> = dynamic(() =>
  import('antd').then(({ Collapse }) => Collapse.Panel)
)

const Collapse = styled(ACollapse).attrs({
  expandIconPosition: 'end',
})<{ $isCollapsible: boolean }>`
  &&& {
    --border-color: ${({ theme }) => theme.color.neutral8};

    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    width: 100%;

    .ant-collapse-header {
      cursor: ${({ $isCollapsible }) => ($isCollapsible ? 'pointer' : 'initial')};
      padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
    }

    .ant-collapse-header-text {
      margin-right: ${({ $isCollapsible }) =>
        spacingIncrement($isCollapsible ? 20 : 0)}; // space for the expand icon
      width: 100%;
    }

    .ant-collapse-arrow {
      color: ${({ theme }) => theme.color.neutral3};
    }

    .ant-collapse-item {
      border: none;
    }

    .ant-collapse-content {
      background: transparent;
      border: none;
    }

    .ant-collapse-content-box {
      padding: 0 ${spacingIncrement(12)} ${spacingIncrement(12)};
    }
  }
`

const CollapseHeader = styled.div`
  color: ${({ theme }) => theme.color.neutral3};
  display: flex;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  justify-content: space-between;
`

export const Divider = styled.span.attrs({
  'aria-hidden': true,
})`
  background: var(--border-color);
  width: 100%;
  height: 1px;
`

export const OperationSummary: React.FC<{
  header: ReactNode
  isCollapsible?: boolean
}> = ({ children, isCollapsible = true, header }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Collapse {...(isCollapsible ? {} : { activeKey: 'main' })} $isCollapsible={isCollapsible}>
    <ACollapsePanel
      key="main"
      header={<CollapseHeader>{header}</CollapseHeader>}
      showArrow={isCollapsible}
    >
      <Flex flexDirection="column" width="100%" gap={8}>
        <Divider />
        {children}
      </Flex>
    </ACollapsePanel>
  </Collapse>
)
