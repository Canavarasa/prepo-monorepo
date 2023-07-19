import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import Tabs, { TabsProps } from './Tabs'
import { noSelect } from '../styles/noSelect.style'

type Props = TabsProps
const StyledTabs = styled(Tabs)`
  &&& {
    .ant-tabs-nav {
      align-items: flex-start;
      padding: ${spacingIncrement(24)};
      padding-bottom: ${spacingIncrement(8)};
      margin-bottom: 0;
    }
    .ant-tabs-tab {
      padding: 0;
      opacity: 1;
    }
    .ant-tabs-nav-list {
      gap: ${spacingIncrement(30)};
    }
    .ant-tabs-tab-btn {
      color: ${({ theme }): string => theme.color.neutral3};
      font-size: ${({ theme }): string => theme.fontSize.md};
      line-height: ${spacingIncrement(20)};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      padding-bottom: ${spacingIncrement(8)};
      transition: none;
      ${noSelect}
    }
    .ant-tabs-tab-active {
      .ant-tabs-tab-btn {
        color: ${({ theme }): string => theme.color.secondary};
        font-size: ${({ theme }): string => theme.fontSize.lg};
      }
    }
    .ant-tabs-ink-bar {
      transition: none;
    }
  }
`

// eslint-disable-next-line react/jsx-props-no-spreading
const PageTabs: React.FC<Props> = (props) => <StyledTabs {...props} />

export default PageTabs
