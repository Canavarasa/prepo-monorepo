import type { LayoutProps, Layout as LayoutType } from 'antd'
import styled from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'
import dynamic from 'next/dynamic'
import { ComponentProps, ComponentType } from 'react'
import Header from './Header'

const ALayout: ComponentType<LayoutProps> = dynamic(() =>
  import('antd').then(({ Layout }) => Layout)
)

const ALayoutContent: ComponentType<ComponentProps<typeof LayoutType.Content>> = dynamic(() =>
  import('antd').then(
    ({ Layout }) => Layout.Content as ComponentType<ComponentProps<typeof Layout.Content>>
  )
)

const Wrapper = styled.div`
  &&& {
    .ant-layout {
      background-color: ${({ theme }): string => theme.color.neutral10};
      min-height: 100vh;
      .ant-layout-content {
        display: flex;
        flex: 1;
        flex-direction: column;
        padding: ${spacingIncrement(20)} ${spacingIncrement(8)};
        padding-bottom: ${spacingIncrement(80)};
        ${media.desktop`
          padding-top: ${spacingIncrement(68)};
        `}
      }
    }
  }
`

//! Will need to make sure if <Navigation /> will be rendered in all the components?
const Layout: React.FC = ({ children }) => (
  <Wrapper>
    <ALayout>
      <Header />
      <ALayoutContent>{children}</ALayoutContent>
    </ALayout>
  </Wrapper>
)

export default Layout
