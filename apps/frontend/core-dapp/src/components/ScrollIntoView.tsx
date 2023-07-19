import { useEffect, useRef } from 'react'

export const ScrollIntoView: React.FC<{ enabled?: boolean }> = ({ children, enabled = true }) => {
  const ref = useRef<HTMLDivElement>(null)
  const executed = useRef(false)

  useEffect(() => {
    if (enabled && !executed.current) {
      ref.current?.scrollIntoView({ behavior: 'smooth' })
    }

    executed.current = true
  }, [enabled])

  return <div ref={ref}>{children}</div>
}
