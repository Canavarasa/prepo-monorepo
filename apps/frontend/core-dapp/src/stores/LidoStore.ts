import retry from 'async-retry'
import { makeAutoObservable } from 'mobx'

type LidoAprResponse = {
  data: { smaApr: number }
}

export class LidoStore {
  private _apr: number | undefined = undefined

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    retry(async () => {
      this._apr = await LidoStore.fetchApr()
    })
  }

  get apr(): string | undefined {
    if (this._apr === undefined) return undefined
    return Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'percent',
    }).format(this._apr)
  }

  private static async fetchApr(): Promise<number> {
    const response = await fetch('https://eth-api.lido.fi/v1/protocol/steth/apr/sma')
    const body: unknown = await response.json()

    if (response.status !== 200) {
      throw new Error('Unexpected response from Lido')
    }

    return (body as LidoAprResponse).data.smaApr / 100
  }
}
