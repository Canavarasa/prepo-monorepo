import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a getter that accesses the latest value. The getter will always be
 * the same function and never update.
 *
 * This is useful to imperatively access a value inside an effect without
 * listing the value itself as a dependency. Listing the getter as an effect
 * dependency will not cause the effect to re-execute because the getter never
 * changes.
 */
export function useGetter<T>(value: T): () => T {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return useCallback(() => ref.current, [])
}
