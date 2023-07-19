import { makeAutoObservable, runInAction } from 'mobx'
import { ThemeModes } from 'prepo-ui'

const systemLightQuery =
  typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-color-scheme: light)')

export class MediaQueryStore {
  private systemIsLight = !!systemLightQuery?.matches
  constructor() {
    makeAutoObservable(this)
    this.syncSystemIsLight()
  }

  get systemThemeMode(): ThemeModes {
    return this.systemIsLight ? ThemeModes.Light : ThemeModes.Dark
  }

  private syncSystemIsLight(): void {
    if (!systemLightQuery) return
    systemLightQuery.onchange = (e): void => {
      runInAction(() => {
        this.systemIsLight = e.matches
      })
    }
  }
}
