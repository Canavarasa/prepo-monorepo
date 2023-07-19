import dynamic, { LoaderComponent } from 'next/dynamic'
import { ComponentType } from 'react'
import { IconProps } from './icon.types'

export function icon(
  name: string,
  importer: () => Promise<{ default: ComponentType }>
): ComponentType<Omit<IconProps, 'name'>> {
  const Icon = dynamic(() => importer().then((it) => it.default) as LoaderComponent)
  Icon.displayName = `Icon(${name})`
  return Icon
}
