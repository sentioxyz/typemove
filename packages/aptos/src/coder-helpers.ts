import { ResourceChange } from './models'
import { MoveCoder } from './move-coder'

export async function decodeResourceChange<T>(
  resources: {
    [key: string]: any
  }[],
  coder: MoveCoder
): Promise<ResourceChange<T>[]> {
  const promises = resources.map(async (r) => {
    r.data = await coder.decodeResource<T>(r.data)
    return r as ResourceChange<T>
  })
  return await Promise.all(promises)
}
