import { makeError } from 'prepo-utils'
import { makeAutoObservable } from 'mobx'
import { Toast } from './utils/stores.types'
import { RootStore } from './RootStore'

export class ToastStore {
  root: RootStore<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: Toast

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(root: RootStore<unknown>, toast: Toast) {
    this.root = root
    this.toast = toast
    makeAutoObservable(this)
  }

  successToast(title: string, description?: string): void {
    this.toast.success(title, { description })
  }

  warningToast(title: string, description?: string): void {
    this.toast.warning(title, { description })
  }

  errorToast(title: string, err: unknown): void {
    const error = makeError(err, false)
    const description = error.message
    this.toast.error(title, { description })
  }
}
