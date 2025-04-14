import { Transaction } from '@mysten/sui/transactions'
import { SuiObjectResponse } from '@mysten/sui/client'
import {
  get_price_x128_from_real_id,
  get_real_id,
  get_real_id_from_price_x128,
  get_storage_id_from_real_id,
} from '@magmaprotocol/calc_dlmm'
import Decimal from 'decimal.js'
import { BinMath } from 'src/math'
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
  DlmmPosition,
  DlmmPositionInfo,
  MintByStrategyParams,
} from '../types/dlmm'
import {
  CachedContent,
  cacheTime24h,
  cacheTime5min,
  extractStructTagFromType,
  getFutureTime,
  getObjectFields,
  getObjectOwner,
  getObjectType,
  TransactionUtil,
} from '../utils'
import { CLOCK_ADDRESS, DlmmScript, getPackagerConfigs, SuiResource } from '../types'
import { MagmaClmmSDK } from '../sdk'
import { IModule } from '../interfaces/IModule'
import { ClmmpoolsError, PositionErrorCode, TypesErrorCode } from '../errors/errors'

export class DlmmModule implements IModule {
  protected _sdk: MagmaClmmSDK

  private readonly _cache: Record<string, CachedContent> = {}

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

  // NOTE: x, y should be sorted
  async createPairPayload(params: CreatePairParams): Promise<Transaction> {
    const storage_id = get_storage_id_from_real_id(
      BinMath.getBinIdFromPrice(params.priceTokenBPerTokenA, params.bin_step, params.coinADecimal, params.coinBDecimal)
    )

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

  async mintByStrategy(params: MintByStrategyParams): Promise<Transaction> {
    const tx = new Transaction()
    const slippage = new Decimal(params.slippage)
    const lower_slippage = new Decimal(1).plus(slippage.div(new Decimal(10000)))
    const upper_slippage = new Decimal(1).plus(slippage.div(new Decimal(10000)))

    tx.setSender(this.sdk.senderAddress)

    const { dlmm_pool, integrate } = this.sdk.sdkOptions
    const dlmmConfig = getPackagerConfigs(dlmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB]

    const price = get_price_x128_from_real_id(params.active_bin, params.bin_step)
    const min_price = new Decimal(price).mul(lower_slippage)
    const max_price = new Decimal(price).mul(upper_slippage)

    const active_min = get_storage_id_from_real_id(get_real_id_from_price_x128(min_price.toDecimalPlaces(0).toString(), params.bin_step))
    const active_max = get_storage_id_from_real_id(get_real_id_from_price_x128(max_price.toDecimalPlaces(0).toString(), params.bin_step))

    const allCoins = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
    let primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountATotal), params.coinTypeA, false, true)
    let primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(params.amountBTotal), params.coinTypeB, false, true)

    let amount_min = 0
    let amount_max = 0
    if (params.fixCoinA) {
      amount_min = new Decimal(params.amountATotal).mul(lower_slippage).toDecimalPlaces(0).toNumber()
      amount_max = new Decimal(params.amountATotal).mul(upper_slippage).toDecimalPlaces(0).toNumber()
      primaryCoinBInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amount_max), params.coinTypeB, false, true)
    }
    if (params.fixCoinB) {
      amount_min = new Decimal(params.amountBTotal).mul(lower_slippage).toDecimalPlaces(0).toNumber()
      amount_max = new Decimal(params.amountBTotal).mul(upper_slippage).toDecimalPlaces(0).toNumber()
      primaryCoinAInputs = TransactionUtil.buildCoinForAmount(tx, allCoins, BigInt(amount_max), params.coinTypeB, false, true)
    }

    if (params.fixCoinA && params.fixCoinB) {
    } else if (params.fixCoinA) {
      params.amountBTotal = 0
    } else if (params.fixCoinB) {
      params.amountATotal = 0
    }

    const args = [
      tx.object(params.pair),
      tx.object(dlmmConfig.factory),
      primaryCoinAInputs.targetCoin,
      primaryCoinBInputs.targetCoin,
      tx.pure.u64(params.amountATotal),
      tx.pure.u64(params.amountBTotal),
      tx.pure.u8(params.strategy),
      tx.pure.u32(params.min_bin),
      tx.pure.u32(params.max_bin),
      tx.pure.u32(active_min),
      tx.pure.u32(active_max),
      tx.pure.u64(amount_min),
      tx.pure.u64(amount_max),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${DlmmScript}::mint_percent`,
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

  async collectFeeAndReward(params: DlmmCollectRewardParams & DlmmCollectFeeParams): Promise<Transaction> {
    let tx = new Transaction()
    tx = await this.collectFees(params)
    if (params.rewards_token.length > 0) {
      tx = await this.collectReward(params)
    }
    return tx
  }

  async collectReward(params: DlmmCollectRewardParams, transaction?: Transaction): Promise<Transaction> {
    const tx = transaction || new Transaction()
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

  async collectFees(params: DlmmCollectFeeParams, transaction?: Transaction): Promise<Transaction> {
    const tx = transaction || new Transaction()
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

    const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)
    const primaryCoinInputA = TransactionUtil.buildCoinForAmount(
      tx,
      allCoinAsset,
      params.swapForY ? BigInt(params.amountIn) : BigInt(0),
      params.coinTypeA,
      false,
      true
    )

    const primaryCoinInputB = TransactionUtil.buildCoinForAmount(
      tx,
      allCoinAsset,
      params.swapForY ? BigInt(0) : BigInt(params.amountIn),
      params.coinTypeB,
      false,
      true
    )

    const args = [
      tx.object(params.pair),
      tx.object(global_config_id),
      primaryCoinInputA.targetCoin,
      primaryCoinInputB.targetCoin,
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

  /**
   * Gets a list of positions for the given account address.
   * @param accountAddress The account address to get positions for.
   * @param assignPoolIds An array of pool IDs to filter the positions by.
   * @returns array of Position objects.
   */
  async getUserPositionById(positionId: string, showDisplay = true): Promise<DlmmPositionInfo> {
    let position
    const ownerRes: any = await this._sdk.fullClient.getObject({
      id: positionId,
      options: { showContent: true, showType: true, showDisplay, showOwner: true },
    })

    const type = extractStructTagFromType(ownerRes.data.type)
    if (type.full_address === this.buildPositionType()) {
      position = this.buildPosition(ownerRes)
    } else {
      throw new ClmmpoolsError(`Dlmm Position not exists. Get Position error:${ownerRes.error}`, PositionErrorCode.InvalidPositionObject)
    }
    const poolMap = new Set<string>()
    poolMap.add(position.pool)
    const pool = (await this.getPoolInfo(Array.from(poolMap)))[0]
    const _params: GetPairRewarderParams[] = []
    _params.push({
      pool_id: pool.pool_id,
      coin_a: pool.coin_a,
      coin_b: pool.coin_b,
    })

    const pool_reward_coins = await this.getPairRewarders(_params)
    // 1. Get Liquidity
    // 2. Get rewards
    // 3. Get fees
    const positionLiquidity = await this.getPositionLiquidity({
      pair: position.pool,
      positionId: position.pos_object_id,
      coinTypeA: pool?.coin_a!,
      coinTypeB: pool?.coin_b!,
    })
    const rewards_token = pool_reward_coins.get(position.pool) || []
    let positionRewards: DlmmEventEarnedRewards = { position_id: position.pos_object_id, reward: [], amount: [] }
    if (rewards_token.length > 0) {
      positionRewards = await this.getEarnedRewards({
        pool_id: position.pool,
        position_id: position.pos_object_id,
        coin_a: pool?.coin_a!,
        coin_b: pool?.coin_b!,
        rewards_token: pool_reward_coins.get(position.pool) || [],
      })
    }

    const positionFees = await this.getEarnedFees({
      pool_id: position.pool,
      position_id: position.pos_object_id,
      coin_a: pool?.coin_a!,
      coin_b: pool?.coin_b!,
    })

    return {
      position,
      liquidity: positionLiquidity,
      rewards: positionRewards,
      fees: positionFees,
      contractPool: pool,
    }
  }

  /**
   * Gets a list of positions for the given account address.
   * @param accountAddress The account address to get positions for.
   * @param assignPoolIds An array of pool IDs to filter the positions by.
   * @returns array of Position objects.
   */
  async getUserPositions(accountAddress: string, assignPoolIds: string[] = [], showDisplay = true): Promise<DlmmPositionInfo[]> {
    const allPosition = []
    const ownerRes: any = await this._sdk.fullClient.getOwnedObjectsByPage(accountAddress, {
      options: { showType: true, showContent: true, showDisplay, showOwner: true },
      filter: { Package: this._sdk.sdkOptions.dlmm_pool.package_id },
    })

    const hasAssignPoolIds = assignPoolIds.length > 0
    for (const item of ownerRes.data as any[]) {
      const type = extractStructTagFromType(item.data.type)

      if (type.full_address === this.buildPositionType()) {
        const position = this.buildPosition(item)
        const cacheKey = `${position.pos_object_id}_getPositionList`
        this.updateCache(cacheKey, position, cacheTime24h)
        if (hasAssignPoolIds) {
          if (assignPoolIds.includes(position.pool)) {
            allPosition.push(position)
          }
        } else {
          allPosition.push(position)
        }
      }
    }

    const poolMap = new Set<string>()
    for (const item of allPosition) {
      poolMap.add(item.pool)
    }
    const poolList = await this.getPoolInfo(Array.from(poolMap))
    this.updateCache(`${DlmmScript}_positionList_poolList`, poolList, cacheTime24h)
    const _params: GetPairRewarderParams[] = []

    for (const pool of poolList) {
      _params.push({
        pool_id: pool.pool_id,
        coin_a: pool.coin_a,
        coin_b: pool.coin_b,
      })
    }

    const pool_reward_coins = await this.getPairRewarders(_params)

    const out = []

    // 1. Get Liquidity
    // 2. Get rewards
    // 3. Get fees
    for (const item of allPosition) {
      const pool = poolList.find((pool) => pool.pool_id === item.pool)
      const positionLiquidity = await this.getPositionLiquidity({
        pair: item.pool,
        positionId: item.pos_object_id,
        coinTypeA: pool?.coin_a!,
        coinTypeB: pool?.coin_b!,
      })
      const rewards_token = pool_reward_coins.get(item.pool) || []
      let positionRewards: DlmmEventEarnedRewards = { position_id: item.pos_object_id, reward: [], amount: [] }
      if (rewards_token.length > 0) {
        positionRewards = await this.getEarnedRewards({
          pool_id: item.pool,
          position_id: item.pos_object_id,
          coin_a: pool?.coin_a!,
          coin_b: pool?.coin_b!,
          rewards_token: pool_reward_coins.get(item.pool) || [],
        })
      }

      const positionFees = await this.getEarnedFees({
        pool_id: item.pool,
        position_id: item.pos_object_id,
        coin_a: pool?.coin_a!,
        coin_b: pool?.coin_b!,
      })
      out.push({
        position: item,
        liquidity: positionLiquidity,
        rewards: positionRewards,
        fees: positionFees,
        contractPool: pool,
      })
    }

    return out
  }

  private buildPosition(object: SuiObjectResponse): DlmmPosition {
    if (object.error != null || object.data?.content?.dataType !== 'moveObject') {
      throw new ClmmpoolsError(`Dlmm Position not exists. Get Position error:${object.error}`, PositionErrorCode.InvalidPositionObject)
    }
    const fields = getObjectFields(object)

    const ownerWarp = getObjectOwner(object) as {
      AddressOwner: string
    }

    return {
      pos_object_id: fields.id.id,
      owner: ownerWarp.AddressOwner,
      pool: fields.pair_id,
      bin_real_ids: (fields.bin_ids as number[]).map((id) => get_real_id(id)),
      type: '',
    }
  }

  // return [coin_a, coin_b]
  private async getPoolCoins(pools: string[]): Promise<Map<string, string[]>> {
    const res = await this._sdk.fullClient.multiGetObjects({ ids: pools, options: { showContent: true } })

    const poolCoins = new Map<string, string[]>()

    res.forEach((item) => {
      if (item.error != null || item.data?.content?.dataType !== 'moveObject') {
        throw new Error(`Failed to get poolCoins with err: ${item.error}`)
      }

      const type = getObjectType(item) as string
      const poolTypeFields = extractStructTagFromType(type)

      poolCoins.set(item.data.objectId, poolTypeFields.type_arguments)
    })
    return poolCoins
  }

  private buildPositionType(): string {
    return `${this._sdk.sdkOptions.dlmm_pool.package_id}::dlmm_position::Position`
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
      bin_real_ids: [],
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
        out.bin_real_ids = (item.parsedJson.bin_ids as number[]).map((id) => get_real_id(id))
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
      throw new Error(`fetchPairRewards error code: ${simulateRes.error ?? 'unknown error'}`)
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

    const args = [tx.object(params.pool_id), tx.object(params.position_id), tx.object(CLOCK_ADDRESS)]
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
      throw new Error(`getEarnedRewards error code: ${simulateRes.error ?? 'unknown error'}`)
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

  // return pool_id => reward_tokens
  async getPairRewarders(params: GetPairRewarderParams[]): Promise<Map<string, string[]>> {
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

  private async _parsePairRewarders(tx: Transaction): Promise<Map<string, string[]>> {
    const { simulationAccount } = this.sdk.sdkOptions

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    const out = new Map<string, string[]>()
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
        item.parsedJson.tokens.forEach((token: any) => {
          pairRewards.tokens.push(token.name)
        })

        out.set(pairRewards.pair_id, pairRewards.tokens)
      }
    })
    return out
  }

  /**
   * Updates the cache for the given key.
   *
   * @param key The key of the cache entry to update.
   * @param data The data to store in the cache.
   * @param time The time in minutes after which the cache entry should expire.
   */
  updateCache(key: string, data: SuiResource, time = cacheTime5min) {
    let cacheData = this._cache[key]
    if (cacheData) {
      cacheData.overdueTime = getFutureTime(time)
      cacheData.value = data
    } else {
      cacheData = new CachedContent(data, getFutureTime(time))
    }
    this._cache[key] = cacheData
  }

  /**
   * Gets the cache entry for the given key.
   *
   * @param key The key of the cache entry to get.
   * @param forceRefresh Whether to force a refresh of the cache entry.
   * @returns The cache entry for the given key, or undefined if the cache entry does not exist or is expired.
   */
  getCache<T>(key: string, forceRefresh = false): T | undefined {
    const cacheData = this._cache[key]
    const isValid = cacheData?.isValid()
    if (!forceRefresh && isValid) {
      return cacheData.value as T
    }
    if (!isValid) {
      delete this._cache[key]
    }
    return undefined
  }
}
