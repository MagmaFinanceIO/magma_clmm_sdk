import { Transaction } from '@mysten/sui/transactions'
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
  DlmmPoolInfo,
} from 'src/types/dlmm'
import Decimal from 'decimal.js'
import { get_real_id_from_price, get_storage_id_from_real_id } from '@magmaprotocol/calc_dlmm'
import { extractStructTagFromType, getObjectFields, TransactionUtil } from '../utils'
import { CLOCK_ADDRESS, DlmmScript, getPackagerConfigs } from '../types'
import { MagmaClmmSDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { ClmmpoolsError, TypesErrorCode } from '../errors/errors'

export class DlmmModule implements IModule {
  protected _sdk: MagmaClmmSDK

  constructor(sdk: MagmaClmmSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  async getPoolInfo(pools: string[]): Promise<DlmmPoolInfo[]> {
    const objects = await this._sdk.fullClient.batchGetObjects(pools, { showContent: true })

    const poolList: DlmmPoolInfo[] = []
    objects.forEach((obj) => {
      if (obj.error != null || obj.data?.content?.dataType !== 'moveObject') {
        throw new ClmmpoolsError(`Invalid objects. error: ${obj.error}`, TypesErrorCode.InvalidType)
      }

      const fields = getObjectFields(obj)
      poolList.push({
        pool_id: fields.id.id,
        bin_step: fields.bin_step,
        coin_a: fields.x.fields.name,
        coin_b: fields.y.fields.name,
        base_factor: fields.params.fields.base_factor,
        base_fee: (fields.params.fields.base_factor / 10000) * (fields.bin_step / 10000),
        active_index: fields.params.fields.active_index,
      })
    })

    return poolList
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

    let res: EventPairParams = {
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
      console.log(extractStructTagFromType(item.type).name)
      if (extractStructTagFromType(item.type).name === `EventPairParams`) {
        res = item.parsedJson.params
      }
    })

    return res
  }

  // params price: input (b/(10^b_decimal))/(a/(10^a_decimal))
  price_to_storage_id(price: string, bin_step: number, tokenADecimal: number, tokenBDecimal: number): number {
    const priceDec = new Decimal(price)
    const tenDec = new Decimal(10)
    const twoDec = new Decimal(2)
    const price_x128 = priceDec.mul(tenDec.pow(tokenBDecimal)).div(tenDec.pow(tokenADecimal)).mul(twoDec.pow(128))
    const active_id = get_real_id_from_price(price_x128.toFixed(0).toString(), bin_step)
    return get_storage_id_from_real_id(active_id)
  }

  // NOTE: x, y should be sorted
  async createPairPayload(params: CreatePairParams): Promise<Transaction> {
    const storage_id = this.price_to_storage_id(params.priceTokenBPerTokenA, params.bin_step, params.coinADecimal, params.coinBDecimal)

    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { clmm_pool, dlmm_pool, integrate } = this.sdk.sdkOptions
    const { global_config_id } = getPackagerConfigs(clmm_pool)
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]
    const args = [tx.object(dlmmConfig.factory), tx.object(global_config_id), tx.pure.u16(params.bin_step), tx.pure.u32(storage_id)]

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

  // Create a position by percent
  async mintPercent(params: MintPercentParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
    const primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountATotal), params.coinTypeA, false, true)
    const primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountBTotal), params.coinTypeB, false, true)

    const args = [
      tx.object(params.pair),
      tx.object(dlmmConfig.factory),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
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

  // Create a position by amount
  async createPositionByAmount(params: MintAmountParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
    const primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountATotal), params.coinTypeA, false, true)
    const primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountBTotal), params.coinTypeB, false, true)

    const args = [
      tx.object(params.pair),
      tx.object(dlmmConfig.factory),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
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
