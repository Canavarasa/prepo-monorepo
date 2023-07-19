import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { SkeletonTheme } from 'react-loading-skeleton'
import { CustomThemeProvider, PresetTheme, ToastStyle } from 'prepo-ui'
import GlobalStyle, { AntdGlobalStyle } from './GlobalStyle'
import { useRootStore } from '../context/RootStoreProvider'

const AppBootstrap: React.FC = ({ children }) => {
  const { localStorageStore, web3Store, uiStore } = useRootStore()

  useEffect(() => {
    localStorageStore.load()
  }, [localStorageStore])

  useEffect(() => {
    if (localStorageStore) {
      web3Store.init()
    }
  }, [web3Store, localStorageStore])

  useEffect(() => {
    uiStore.setMaxScreenHeight(window.innerHeight)
  }, [uiStore])

  return (
    <SkeletonTheme>
      <CustomThemeProvider theme={PresetTheme.CoreDapp} mode={uiStore.selectedTheme}>
        <GlobalStyle />
        <AntdGlobalStyle />
        <ToastStyle />
        {children}
      </CustomThemeProvider>
    </SkeletonTheme>
  )
}

export default observer(AppBootstrap)
