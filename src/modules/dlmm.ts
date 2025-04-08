import { Transaction } from '@mysten/sui/transactions'
import { get_real_id_from_price_x128, get_storage_id_from_real_id } from '@magmaprotocol/calc_dlmm'
import Decimal from 'decimal.js'
import {
  EventBin,
  CreatePairParams,
  FetchBinsParams,
  MintAmountParams,
  MintPercentParams,
  DLMMSwapParams,
  EventPositionLiquidity,
  GetPositionLiquidityParams,
  EventPairLiquidity,
  GetPairLiquidityParams,
  FetchPairParams,
  EventPairParams,
  DlmmPoolInfo,
  DlmmAddLiquidityParams,
  DlmmBurnPositionParams,
  DlmmShrinkPosition,
  DlmmCollectRewardParams,
  DlmmCollectFeeParams,
  DlmmEventEarnedFees,
  DlmmRewardsParams,
  DlmmEventEarnedRewards,
  GetPairRewarderParams,
  DlmmEventPairRewardTypes,
  DlmmCreatePairAddLiquidityParams,
} from '../types/dlmm'
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
    const active_id = get_real_id_from_price_x128(price_x128.toFixed(0).toString(), bin_step)
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
    const args = [
      tx.object(dlmmConfig.factory),
      tx.object(global_config_id),
      tx.pure.u64(params.base_fee),
      tx.pure.u16(params.bin_step),
      tx.pure.u32(storage_id),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::create_pair`,
      typeArguments,
      arguments: args,
    })
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

  async addLiquidity(params: DlmmAddLiquidityParams): Promise<Transaction> {
    if (params.rewards_token.length === 0) {
      return this._raisePositionByAmounts(params)
    }
    return this._raisePositionByAmountsReward(params)
  }

  private async _raisePositionByAmounts(params: DlmmAddLiquidityParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coin_a, params.coin_b]

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)

    const amountATotal = params.amounts_a.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
    const amountBTotal = params.amounts_b.reduce((accumulator, currentValue) => accumulator + currentValue, 0)

    const primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountATotal), params.coin_a, false, true)
    const primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountBTotal), params.coin_b, false, true)

    const args = [
      tx.object(params.pool_id),
      tx.object(dlmmConfig.factory),
      tx.object(params.position_id),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
      tx.pure.vector('u64', params.amounts_a),
      tx.pure.vector('u64', params.amounts_b),
      tx.pure.address(params.receiver),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::raise_position_by_amounts`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  private async _raisePositionByAmountsReward(params: DlmmAddLiquidityParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate, clmm_pool } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)
    const clmmConfigs = getPackagerConfigs(clmm_pool)

    const typeArguments = [params.coin_a, params.coin_b, ...params.rewards_token]

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)

    const amountATotal = params.amounts_a.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
    const amountBTotal = params.amounts_b.reduce((accumulator, currentValue) => accumulator + currentValue, 0)

    const primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountATotal), params.coin_a, false, true)
    const primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountBTotal), params.coin_b, false, true)

    const args = [
      tx.object(params.pool_id),
      tx.object(dlmmConfig.factory),
      tx.object(clmmConfigs.global_vault_id),
      tx.object(params.position_id),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
      tx.pure.vector('u64', params.amounts_a),
      tx.pure.vector('u64', params.amounts_b),
      tx.pure.address(params.receiver),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::raise_position_by_amounts_reward${params.rewards_token.length}`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async burnPosition(params: DlmmBurnPositionParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { integrate, clmm_pool } = this.sdk.sdkOptions
    const clmmConfigs = getPackagerConfigs(clmm_pool)
    const typeArguments = [params.coin_a, params.coin_b, ...params.rewards_token]
    let args = [tx.object(params.pool_id), tx.object(params.position_id), tx.object(CLOCK_ADDRESS)]
    let target = `${integrate.published_at}::${DlmmScript}::burn_position`

    if (params.rewards_token.length > 0) {
      args = [tx.object(params.pool_id), tx.object(clmmConfigs.global_vault_id), tx.object(params.position_id), tx.object(CLOCK_ADDRESS)]
      target = `${integrate.published_at}::${DlmmScript}::burn_position_reward${params.rewards_token.length}`
    }

    tx.moveCall({
      target,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async shrinkPosition(params: DlmmShrinkPosition): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { integrate, clmm_pool } = this.sdk.sdkOptions
    const clmmConfigs = getPackagerConfigs(clmm_pool)
    const typeArguments = [params.coin_a, params.coin_b, ...params.rewards_token]
    let args = [tx.object(params.pool_id), tx.object(params.position_id), tx.pure.u64(params.delta_percentage), tx.object(CLOCK_ADDRESS)]
    let target = `${integrate.published_at}::${DlmmScript}::shrink_position`

    if (params.rewards_token.length > 0) {
      args = [
        tx.object(params.pool_id),
        tx.object(clmmConfigs.global_vault_id),
        tx.object(params.position_id),
        tx.pure.u64(params.delta_percentage),
        tx.object(CLOCK_ADDRESS),
      ]
      target = `${integrate.published_at}::${DlmmScript}::shrink_position_reward${params.rewards_token.length}`
    }

    tx.moveCall({
      target,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async collectReward(params: DlmmCollectRewardParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { integrate, clmm_pool } = this.sdk.sdkOptions
    const clmmConfigs = getPackagerConfigs(clmm_pool)
    const typeArguments = [params.coin_a, params.coin_b, ...params.rewards_token]
    const args = [
      tx.object(params.pool_id),
      tx.object(clmmConfigs.global_vault_id),
      tx.object(params.position_id),
      tx.object(CLOCK_ADDRESS),
    ]
    let target = `${integrate.published_at}::${DlmmScript}::collect_reward`

    if (params.rewards_token.length > 1) {
      target = `${integrate.published_at}::${DlmmScript}::collect_reward${params.rewards_token.length}`
    }

    tx.moveCall({
      target,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async collectFees(params: DlmmCollectFeeParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { integrate } = this.sdk.sdkOptions
    const typeArguments = [params.coin_a, params.coin_b]
    const args = [tx.object(params.pool_id), tx.object(params.position_id), tx.object(CLOCK_ADDRESS)]
    const target = `${integrate.published_at}::${DlmmScript}::collect_fees`

    tx.moveCall({
      target,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async createPairAddLiquidity(params: DlmmCreatePairAddLiquidityParams): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)
    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)

    const amountATotal = params.amountsX.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
    const amountBTotal = params.amountsY.reduce((accumulator, currentValue) => accumulator + currentValue, 0)

    const primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountATotal), params.coinTypeA, false, true)
    const primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amountBTotal), params.coinTypeB, false, true)

    const args = [
      tx.object(dlmmConfig.factory),
      tx.pure.u64(params.baseFee),
      tx.pure.u16(params.binStep),
      tx.pure.u32(params.activeId),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
      tx.pure.vector('u32', params.storageIds),
      tx.pure.vector('u64', params.amountsX),
      tx.pure.vector('u64', params.amountsY),
      tx.pure.address(params.to),
      tx.object(CLOCK_ADDRESS),
    ]
    const target = `${integrate.published_at}::${DlmmScript}::create_pair_add_liquidity`

    tx.moveCall({
      target,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async swap(params: DLMMSwapParams): Promise<Transaction> {
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

    let res: EventBin[] = []
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventFetchBins`) {
        const { bins } = item.parsedJson
        res = bins
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
        out.bin_ids = item.parsedJson.bin_ids
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

  async getEarnedFees(params: DlmmCollectFeeParams): Promise<DlmmEventEarnedFees> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coin_a, params.coin_b]
    const args = [tx.object(params.pool_id), tx.object(params.position_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::earned_fees`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    const out: DlmmEventEarnedFees = {
      position_id: '',
      x: '',
      y: '',
      fee_x: 0,
      fee_y: 0,
    }
    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventPositionLiquidity`) {
        out.position_id = item.parsedJson.position_id
        out.x = item.parsedJson.x
        out.y = item.parsedJson.y
        out.fee_x = item.parsedJson.fee_x
        out.fee_y = item.parsedJson.fee_y
      }
    })
    return out
  }

  async getEarnedRewards(params: DlmmRewardsParams): Promise<DlmmEventEarnedRewards> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions

    const typeArguments = [params.coin_a, params.coin_b, ...params.rewards_token]

    const args = [tx.object(params.pool_id), tx.object(params.position_id)]
    let target = `${integrate.published_at}::${DlmmScript}::earned_rewards`
    if (params.rewards_token.length > 1) {
      target = `${integrate.published_at}::${DlmmScript}::earned_rewards${params.rewards_token.length}`
    }

    tx.moveCall({
      target,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    const out: DlmmEventEarnedRewards = {
      position_id: '',
      reward: [],
      amount: [],
    }

    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `DlmmEventEarnedRewards`) {
        out.position_id = item.parsedJson.position_id
        out.reward = [item.parsedJson.reward]
        out.amount = [item.parsedJson.amount]
      } else if (extractStructTagFromType(item.type).name === `DlmmEventEarnedRewards2`) {
        out.position_id = item.parsedJson.position_id
        out.reward = [item.parsedJson.reward1, item.parsedJson.reward2]
        out.amount = [item.parsedJson.amount1, item.parsedJson.amount2]
      } else if (extractStructTagFromType(item.type).name === `EventEarnedRewards3`) {
        out.position_id = item.parsedJson.position_id
        out.reward = [item.parsedJson.reward1, item.parsedJson.reward2, item.parsedJson.reward3]
        out.amount = [item.parsedJson.amount1, item.parsedJson.amount2, item.parsedJson.amount3]
      }
    })
    return out
  }

  async getPairRewarders(params: GetPairRewarderParams[]): Promise<Map<string, DlmmEventPairRewardTypes[]>> {
    let tx = new Transaction()
    for (const param of params) {
      tx = await this._getPairRewarders(param, tx)
    }
    return this._parsePairRewarders(tx)
  }

  private async _getPairRewarders(params: GetPairRewarderParams, tx?: Transaction): Promise<Transaction> {
    tx = tx || new Transaction()
    const { integrate } = this.sdk.sdkOptions

    const typeArguments = [params.coin_a, params.coin_b]
    const args = [tx.object(params.pool_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::get_pair_rewarders`,
      arguments: args,
      typeArguments,
    })
    return tx
  }

  private async _parsePairRewarders(tx: Transaction): Promise<Map<string, DlmmEventPairRewardTypes[]>> {
    const { simulationAccount } = this.sdk.sdkOptions

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    const out = new Map<string, DlmmEventPairRewardTypes[]>()
    if (simulateRes.error != null) {
      throw new Error(`fetchBins error code: ${simulateRes.error ?? 'unknown error'}`)
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventPairRewardTypes`) {
        const pairRewards: DlmmEventPairRewardTypes = {
          pair_id: '',
          tokens: [],
        }

        pairRewards.pair_id = item.parsedJson.pair_id
        item.parsedJson.tokens.contents.forEach((token: any) => {
          pairRewards.tokens.push(token.name)
        })
      }
    })
    return out
  }
}
