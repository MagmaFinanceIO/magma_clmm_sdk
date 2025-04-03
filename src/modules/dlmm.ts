import { Transaction } from '@mysten/sui/transactions'
import { CLOCK_ADDRESS, DlmmScript, getPackagerConfigs } from 'src/types'
import {
  EventBin,
  CreatePairParams,
  FetchBinsParams,
  MintAmountParams,
  MintPercentParams,
  SwapParams,
  EventPositionLiquidity,
  GetPositionLiquidityParams,
  EventPairLiquidity,
  GetPairLiquidityParams,
  FetchPairParams,
  EventPairParams,
} from 'src/types/dlmm'
import { extractStructTagFromType } from 'src/utils'
import Decimal from 'decimal.js'
import { get_real_id_from_price } from '@magmaprotocol/calc_dlmm'
import { MagmaClmmSDK } from '../sdk'
import { IModule } from '../interfaces/IModule'

export class DlmmModule implements IModule {
  protected _sdk: MagmaClmmSDK

  constructor(sdk: MagmaClmmSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  // eg: fetch pool active_index
  async fetchPairParams(params: FetchPairParams): Promise<EventPairParams> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [tx.object(params.pair)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::fetch_pair_params`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const res: EventPairParams = {
      base_factor: 0,
      filter_period: 0,
      decay_period: 0,
      reduction_factor: 0,
      variable_fee_control: 0,
      protocol_share: 0,
      max_volatility_accumulator: 0,
      volatility_accumulator: 0,
      volatility_reference: 0,
      index_reference: 0,
      time_of_last_update: 0,
      oracle_index: 0,
      active_index: 0,
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventFetchBins`) {
        res.base_factor = item.parsedJson.base_factor
        res.filter_period = item.parsedJson.filter_period
        res.decay_period = item.parsedJson.decay_period
        res.reduction_factor = item.parsedJson.reduction_factor
        res.variable_fee_control = item.parsedJson.variable_fee_control
        res.protocol_share = item.parsedJson.protocol_share
        res.max_volatility_accumulator = item.parsedJson.max_volatility_accumulator
        res.volatility_accumulator = item.parsedJson.volatility_accumulator
        res.volatility_reference = item.parsedJson.volatility_reference
        res.index_reference = item.parsedJson.index_reference
        res.time_of_last_update = item.parsedJson.time_of_last_update
        res.oracle_index = item.parsedJson.oracle_index
        res.active_index = item.parsedJson.active_index
      }
    })

    return res
  }

  // params price: input (b/(10^b_decimal))/(a/(10^a_decimal))
  price_to_active_id(price: string, bin_step: number, tokenADecimal: number, tokenBDecimal: number): number {
    const priceDec = new Decimal(price)
    const tenDec = new Decimal(10)
    const price_x10_128 = priceDec.mul(tenDec.pow(tokenBDecimal)).div(tenDec.pow(tokenADecimal)).mul(tenDec.pow(128))
    return get_real_id_from_price(price_x10_128.toString(), bin_step)
  }

  // NOTE: x, y should be sorted
  async createPairPayload(params: CreatePairParams): Promise<Transaction> {
    const active_id = this.price_to_active_id(params.priceTokenBPerTokenA, params.bin_step, params.coinADecimal, params.coinBDecimal)

    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { clmm_pool, dlmm_pool, integrate } = this.sdk.sdkOptions
    const { global_config_id } = getPackagerConfigs(clmm_pool)
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const args = [tx.object(dlmmConfig.factory), tx.object(global_config_id), tx.pure.u16(params.bin_step), tx.pure.u32(active_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::create_pair`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async createAddLiquidityPayload(): Promise<Transaction> {
    const tx = new Transaction()

    return tx
  }

  async mintPercent(params: MintPercentParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const args = [
      tx.object(params.pair),
      tx.object(dlmmConfig.factory),
      tx.object(params.coinTypeA),
      tx.object(params.coinTypeB),
      tx.pure.u64(params.amountATotal),
      tx.pure.u64(params.amountBTotal),
      tx.pure.vector('u32', params.storageIds),
      tx.pure.vector('u64', params.binsAPercent),
      tx.pure.vector('u64', params.binsBPercent),
      tx.pure.address(params.to),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::mint_percent`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async mintAmount(params: MintAmountParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const args = [
      tx.object(params.pair),
      tx.object(dlmmConfig.factory),
      tx.object(params.coinTypeA),
      tx.object(params.coinTypeB),
      tx.pure.vector('u32', params.storageIds),
      tx.pure.vector('u64', params.amountsA),
      tx.pure.vector('u64', params.amountsB),
      tx.pure.address(params.to),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::mint_amounts`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async swap(params: SwapParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { clmm_pool, integrate } = this.sdk.sdkOptions
    const { global_config_id } = getPackagerConfigs(clmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const args = [
      tx.object(params.pair),
      tx.object(global_config_id),
      tx.object(params.coinTypeA),
      tx.object(params.coinTypeB),
      tx.pure.u64(params.amountIn),
      tx.pure.u64(params.minAmountOut),
      tx.pure.bool(params.swapForY),
      tx.pure.address(params.to),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::swap`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async fetchBins(params: FetchBinsParams): Promise<EventBin[]> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [tx.object(params.pair), tx.pure.u64(params.offset), tx.pure.u64(params.limit)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::fetch_bins`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const res: EventBin[] = []
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventFetchBins`) {
        // res.set(item.parsedJson.token, item.parsedJson.amount)
        // TODO: ......
      }
    })

    return res
  }

  async getPositionLiquidity(params: GetPositionLiquidityParams): Promise<EventPositionLiquidity> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [tx.object(params.pair), tx.object(params.positionId)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::position_liquidity`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const out: EventPositionLiquidity = {
      shares: 0,
      liquidity: 0,
      x_equivalent: 0,
      y_equivalent: 0,
      bin_ids: [],
      bin_x_eq: [],
      bin_y_eq: [],
      bin_liquidity: [],
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventPositionLiquidity`) {
        out.shares = item.parsedJson.shares
        out.liquidity = item.parsedJson.liquidity
        out.x_equivalent = item.parsedJson.x_equivalent
        out.y_equivalent = item.parsedJson.y_equivalent
        out.bin_ids = item.parsedJson.bin_id
        out.bin_x_eq = item.parsedJson.bin_x_eq
        out.bin_y_eq = item.parsedJson.bin_y_eq
        out.bin_liquidity = item.parsedJson.bin_liquidity
      }
    })
    return out
  }

  async getPairLiquidity(params: GetPairLiquidityParams): Promise<EventPairLiquidity> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [tx.object(params.pair)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::pair_liquidity`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const out: EventPairLiquidity = {
      shares: 0,
      liquidity: 0,
      x: 0,
      y: 0,
      bin_ids: [],
      bin_x: [],
      bin_y: [],
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventPositionLiquidity`) {
        out.shares = item.parsedJson.shares
        out.liquidity = item.parsedJson.liquidity
        out.x = item.parsedJson.x
        out.y = item.parsedJson.y
        out.bin_ids = item.bin_ids
        out.bin_x = item.bin_x
        out.bin_y = item.bin_y
      }
    })
    return out
  }
}
