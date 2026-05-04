import { v4 as uuidv4 } from 'uuid'

export default class Item {
  id: string
  n: string
  q: number | string
  c: number
  u: number
  d: number

  constructor (name: string, quantity: number | string) {
    this.id = uuidv4().substring(0, 8)
    this.n = name
    this.q = quantity
    this.c = 0
    this.u = new Date().getTime()
    this.d = 0
  }
}
