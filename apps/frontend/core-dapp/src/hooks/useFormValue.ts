import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { useGetter } from './useGetter'

export type FormValue<T> = {
  isDirty: boolean
  reset: () => void
  setValue: Dispatch<SetStateAction<T>>
  value: T
}

/**
 * This hooks manages an input that can be modified by the user and has an
 * initial value. It returns an object containing the following:
 *
 * - `isDirty`:
 *   Whether the user has modified the original value.
 *
 * - `reset`:
 *   A function that resets the user's value to the original.
 *
 * - `setValue`:
 *   A function to handle the user input.
 *
 * - `value`:
 *   The current value, either the base value or the user's input.
 */
export function useFormValue<T>(
  baseValue: T,
  { canBecomeDirty = true }: { canBecomeDirty?: boolean } = {}
): FormValue<T> {
  const previousBaseValueRef = useRef(baseValue)

  const [userValue, setUserValue] = useState(baseValue)

  const getCurrentBaseValue = useGetter(baseValue)
  const getCurrentUserValue = useGetter(userValue)

  const isDirty = userValue !== baseValue

  const reset = useCallback(() => {
    setUserValue(getCurrentBaseValue())
  }, [getCurrentBaseValue])

  useEffect(() => {
    if (previousBaseValueRef.current === getCurrentUserValue()) {
      setUserValue(baseValue)
    }

    previousBaseValueRef.current = baseValue
  }, [baseValue, getCurrentUserValue])

  return {
    isDirty: canBecomeDirty && isDirty,
    reset,
    setValue: setUserValue,
    value: userValue ?? baseValue,
  }
}
