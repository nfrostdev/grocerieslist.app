import type Item from './Item'

export default class List {
  id: string
  n: string
  i: Item[]

  constructor (name: string, items: Item[]) {
    this.id = crypto.randomUUID()
    this.n = name
    this.i = items
  }
}
