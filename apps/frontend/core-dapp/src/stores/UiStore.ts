import { makeAutoObservable } from 'mobx'
import { ThemeModes } from 'prepo-ui'
import { RootStore } from './RootStore'

export class UiStore {
  root: RootStore
  showLanguageList = false
  modalHeight: number | undefined
  maxScreenHeight = 0

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this)
  }

  get selectedTheme(): ThemeModes {
    return (
      this.root.localStorageStore.storage.forcedTheme ?? this.root.mediaQueryStore.systemThemeMode
    )
  }

  setShowLanguageList(show: boolean): void {
    this.showLanguageList = show
  }

  setTheme = (selectedTheme: ThemeModes): void => {
    if (selectedTheme === this.root.mediaQueryStore.systemThemeMode) {
      this.root.localStorageStore.storage.forcedTheme = undefined
    } else {
      this.root.localStorageStore.storage.forcedTheme = selectedTheme
    }
  }

  setMaxScreenHeight(height: number): void {
    this.maxScreenHeight = height
  }

  setModalHeight(height: number): void {
    const modalTitleHeightPixelsPlusPaddings = 100
    const modalHeight = height + modalTitleHeightPixelsPlusPaddings
    const seventyPercentOfMaxScreenHeight = this.maxScreenHeight * 0.7

    this.modalHeight =
      modalHeight > seventyPercentOfMaxScreenHeight ? seventyPercentOfMaxScreenHeight : modalHeight
  }
}
