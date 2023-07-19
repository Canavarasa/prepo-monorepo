import { configure } from 'mobx'
import { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import { ToastifyContainer } from 'prepo-ui'
import Layout from '../components/layout/Layout'
import AppBootstrap from '../components/AppBootstrap'
import { RootStoreProvider } from '../context/RootStoreProvider'

import 'antd/dist/antd.css'
import 'react-loading-skeleton/dist/skeleton.css'
import { LightWeightChartProvider } from '../components/charts'
import '../styles/default.css'
import '../styles/scrollbar.css'
import TermsWall from '../features/terms/TermsWall'
import { TestIds } from '../components/TestId'
import VersionsWall from '../components/VersionsWall'
import RegionWall from '../components/RegionWall'
import { compose } from '../utils/compose'

// mobx config
configure({
  enforceActions: 'observed',
  computedRequiresReaction: true,
  reactionRequiresObservable: false,
  observableRequiresReaction: false,
  disableErrorBoundaries: false,
})

function useClient(): boolean {
  const [client, setClient] = useState(false)

  useEffect(() => {
    setClient(true)
  }, [setClient])

  return client
}

const Walls = compose(VersionsWall, TermsWall, RegionWall)

const App: React.FC<AppProps> = ({ Component, pageProps }: AppProps) => {
  const client = useClient()

  // Our styled-components hydration and light/dark mode system is not yet
  // prepared to work with static site generation - disable it entirely for now.
  if (!client) return null

  return (
    <RootStoreProvider>
      <LightWeightChartProvider>
        <AppBootstrap>
          <ToastifyContainer testId={TestIds.Toast} />
          <Layout>
            <Walls>
              {/* eslint-disable-next-line react/jsx-props-no-spreading */}
              <Component {...pageProps} />
            </Walls>
          </Layout>
        </AppBootstrap>
      </LightWeightChartProvider>
    </RootStoreProvider>
  )
}

export default App
