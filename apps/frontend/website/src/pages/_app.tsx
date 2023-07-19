import { ToastContainer } from 'react-toastify'
import { configure } from 'mobx'
import { AppProps } from 'next/app'
import { RootStoreProvider } from '../context/RootStoreProvider'

import 'react-toastify/dist/ReactToastify.css'
import 'tailwindcss/tailwind.css'
import '../styles/default.css'

// mobx config
configure({
  enforceActions: 'observed',
  computedRequiresReaction: true,
  disableErrorBoundaries: false,
  // Disable these rules to prevent warnings logged due to mst-gql dependency
  reactionRequiresObservable: false,
  observableRequiresReaction: false,
})

const App = ({ Component, pageProps }: AppProps): React.ReactElement => (
  <>
    <RootStoreProvider>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <Component {...pageProps} />
    </RootStoreProvider>
    <ToastContainer />
  </>
)

export default App
