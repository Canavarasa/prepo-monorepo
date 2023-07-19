import { useEffect, useState } from 'react'

type PromiseStatus<T> =
  | {
      status: 'loading'
    }
  | {
      status: 'success'
      value: T
    }
  | {
      status: 'error'
      error: unknown
    }

export function usePromise<T>(promiseCreator: () => Promise<T>): PromiseStatus<T> {
  const [status, setStatus] = useState<PromiseStatus<T>>({ status: 'loading' })

  useEffect(() => {
    promiseCreator()
      .then((value) => setStatus({ status: 'success', value }))
      .catch((error) => setStatus({ status: 'error', error }))
  }, [promiseCreator])

  return status
}
