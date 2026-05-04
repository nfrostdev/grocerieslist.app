import { v4 as uuidv4 } from 'uuid'
import type Item from './Item'

export default class List {
  id: string
  n: string
  i: Item[]

  constructor (name: string, items: Item[]) {
    this.id = uuidv4().substring(0, 8)
    this.n = name
    this.i = items
  }
}
