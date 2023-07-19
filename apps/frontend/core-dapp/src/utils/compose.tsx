import { ComponentType, ReactNode } from 'react'

type Component = ComponentType<{ children?: ReactNode }>

export function compose(...[Base, ...other]: [Component, Component, ...Component[]]): Component {
  const Other = other.length === 1 ? other[0] : compose(...(other as [Component, Component]))
  return function Composed({ children }) {
    return (
      <Base>
        <Other>{children}</Other>
      </Base>
    )
  }
}
