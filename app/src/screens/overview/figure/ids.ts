import { createContext, useContext } from 'react'

/** Prefix for the ids of the gradients, filters and clips, so two figures never clash. */
export const Uid = createContext('bf')

/** Reference to a gradient, filter or clip defined in `FigureDefs`. */
export function useUrl(): (name: string) => string {
  const uid = useContext(Uid)
  return (name) => `url(#${uid}-${name})`
}
