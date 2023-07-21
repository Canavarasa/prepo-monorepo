type Deferred<T> = { asPromise: Promise<T>; setValue: (value: T) => void }

export function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined
  let resolved = false

  const promise = new Promise<T>((_resolve) => {
    resolve = _resolve
  })

  return {
    asPromise: promise,
    setValue: (value) => {
      if (resolved) throw new Error('Value already set')
      resolve?.(value)
      resolved = true
    },
  }
}
