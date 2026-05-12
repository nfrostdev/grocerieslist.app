export default class Item {
  id: string
  n: string
  q: string
  c: number
  u: number
  d: number

  constructor (name: string, quantity: string) {
    this.id = crypto.randomUUID()
    this.n = name
    this.q = quantity
    this.c = 0
    this.u = new Date().getTime()
    this.d = 0
  }
}
