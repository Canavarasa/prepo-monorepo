import styled from 'styled-components'
import { coreDappTheme, Flex, media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import dynamic, { LoaderComponent } from 'next/dynamic'
import { ReactNode } from 'react'
import SettingsMenu from '../SettingsMenu'
import PrePOLogo from '../PrePOLogo'
import ConnectButton from '../../features/connect/ConnectButton'
import { Routes } from '../../lib/routes'
import { useRootStore } from '../../context/RootStoreProvider'
import Navigation from '../Navigation'
import isOutdated from '../../utils/isOutdated'
import { useRegionBlocked } from '../RegionWall'
import Link from '../Link'

const AHeader = dynamic(() => import('antd').then(({ Layout }) => Layout.Header) as LoaderComponent)

const { Z_INDEX } = coreDappTheme

const Wrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: ${Z_INDEX.navigation};
  .ant-layout-header {
    align-items: center;
    background-color: ${({ theme }): string => theme.color.neutral10};
    display: flex;
    height: min-content;
    justify-content: space-between;
    padding: ${spacingIncrement(32)} ${spacingIncrement(16)} ${spacingIncrement(16)};
    position: relative;
    ${media.desktop`
      padding: ${spacingIncrement(32)};
    `};
  }
`

const Banner = styled.div`
  background-color: ${({ theme }): string => theme.color.primary};
  color: ${({ theme }): string => theme.color.white};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  line-height: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
  text-align: center;
  width: 100%;
`

const StyledLink = styled(Link)`
  color: ${({ theme }): string => theme.color.white};
  text-decoration: underline;
`

const bannerContent: ReactNode | undefined = undefined

const Header: React.FC = () => {
  const regionBlocked = useRegionBlocked()
  const { termsStore, web3Store } = useRootStore()
  const { showTermsPage } = termsStore
  const { safeAppsSdk } = web3Store

  if (isOutdated || regionBlocked)
    return (
      <Wrapper>
        <AHeader>
          <Flex justifyContent="flex-start" gap={8}>
            <PrePOLogo />
          </Flex>
        </AHeader>
      </Wrapper>
    )

  return (
    <Wrapper>
      {!!bannerContent && <Banner>{bannerContent}</Banner>}
      <AHeader>
        <Flex justifyContent="flex-start" gap={8}>
          <PrePOLogo href={Routes.Home} />
          {!showTermsPage && <Navigation />}
        </Flex>
        <Flex gap={8}>
          {!showTermsPage && !safeAppsSdk && <ConnectButton size="sm" hideWhenConnected />}
          <SettingsMenu />
        </Flex>
      </AHeader>
    </Wrapper>
  )
}

export default observer(Header)
