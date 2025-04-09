import Decimal from 'decimal.js'
import { get_price_x128_from_real_id } from '@magmaprotocol/calc_dlmm'

export class BinMath {
  static getPriceOfBinByBinId(binId: number, binStep: number, decimalsA: number, decimalsB: number): Decimal {
    const twoDec = new Decimal(2)
    const price = new Decimal(get_price_x128_from_real_id(binId, binStep))
    return price.div(twoDec.pow(128)).mul(Decimal.pow(10, decimalsA - decimalsB))
  }
}
