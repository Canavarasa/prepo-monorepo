/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-hooks'
import { useFormValue } from '../useFormValue'

describe('useFormValue', () => {
  it('should return the initial state', () => {
    const { result } = renderHook(() => useFormValue('Apples'))

    expect(result.current.isDirty).toBe(false)
    expect(result.current.value).toBe('Apples')
  })

  it('should set a new value and become dirty', () => {
    const { result } = renderHook(() => useFormValue('Apples'))

    act(() => {
      result.current.setValue('Oranges')
    })

    expect(result.current.isDirty).toBe(true)
    expect(result.current.value).toBe('Oranges')
  })

  it("shouldn't become dirty if `canBecomeDirty = false`", () => {
    const { result } = renderHook(
      () =>
        useFormValue('Apples', {
          canBecomeDirty: false,
        }),
      {}
    )

    act(() => {
      result.current.setValue('Oranges')
    })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.value).toBe('Oranges')
  })

  it('should reset the value to the base value', () => {
    const { result } = renderHook(() => useFormValue('Apples'))

    act(() => {
      result.current.setValue('Oranges')
      result.current.reset()
    })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.value).toBe('Apples')
  })

  it('should sync the user value, if it is not dirty, when the base value changes', () => {
    const { result, rerender } = renderHook(({ baseValue }) => useFormValue(baseValue), {
      initialProps: { baseValue: 'Apples' },
    })

    rerender({ baseValue: 'Bananas' })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.value).toBe('Bananas')
  })

  it('should preserve the user value, if it is dirty, when the base value changes', () => {
    const { result, rerender } = renderHook(({ baseValue }) => useFormValue(baseValue), {
      initialProps: { baseValue: 'Apples' },
    })

    act(() => {
      result.current.setValue('Oranges')
    })

    expect(result.current.isDirty).toBe(true)
    expect(result.current.value).toBe('Oranges')

    rerender({ baseValue: 'Bananas' })

    expect(result.current.isDirty).toBe(true)
    expect(result.current.value).toBe('Oranges')
  })
})
