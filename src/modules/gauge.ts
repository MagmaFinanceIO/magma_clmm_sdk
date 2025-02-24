import { Transaction } from '@mysten/sui/transactions'
import { CLOCK_ADDRESS, Gauge, getPackagerConfigs, Minter, Voter } from '../types'
import { IModule } from '../interfaces/IModule'
import { MagmaClmmSDK } from '../sdk'
import { extractStructTagFromType, getObjectType } from '../utils'

export type DepositPosition = {
  poolId: string
  positionId: string
  coinTypeA: string
  coinTypeB: string
}
export type WithdrawPosition = {
  poolId: string
  positionId: string
  coinTypeA: string
  coinTypeB: string
}

export type EpochEmission = {
  emission: number | string
  rebase: number | string
}

export class GaugeModule implements IModule {
  protected _sdk: MagmaClmmSDK

  constructor(sdk: MagmaClmmSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  async depositPosition(params: DepositPosition): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const poolGauge = await this.getPoolGaguers()
    const gauge = poolGauge.get(params.poolId)
    if (gauge === undefined) {
      throw Error(`Fetch gauge of pool ${params.poolId} failed`)
    }

    const { distribution_cfg, magma_token } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const { clmm_pool, integrate } = this.sdk.sdkOptions
    const clmmConfig = getPackagerConfigs(clmm_pool)

    const typeArguments = [params.coinTypeA, params.coinTypeB, magma_token]
    const args = [
      tx.object(clmmConfig.global_config_id),
      tx.object(distribution_cfg),
      tx.object(gauge),
      tx.object(params.poolId),
      tx.object(params.positionId),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${Gauge}::deposit_position`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async withdrawPosition(params: WithdrawPosition): Promise<Transaction> {
    const tx = new Transaction()
    tx.setSender(this.sdk.senderAddress)

    const poolGauge = await this.sdk.Gauge.getPoolGaguers()
    const gauge = poolGauge.get(params.poolId)
    if (gauge === undefined) {
      throw Error(`Fetch gauge of pool ${params.poolId} failed`)
    }

    const { magma_token } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const { integrate } = this.sdk.sdkOptions

    const typeArguments = [params.coinTypeA, params.coinTypeB, magma_token]
    const args = [tx.object(gauge), tx.object(params.poolId), tx.object(params.positionId), tx.object(CLOCK_ADDRESS)]

    tx.moveCall({
      target: `${integrate.published_at}::${Gauge}::withdraw_position`,
      typeArguments,
      arguments: args,
    })
    return tx
  }

  async getUserStakedPositionInfo(userAddr: string) {
    const poolGauger = await this.getPoolGaguers()
    const poolCoins = await this.getPoolCoins([...poolGauger.keys()])

    const res: any[] = []
    for (const [pool, gauger] of poolGauger) {
      const coins = poolCoins.get(pool)
      if (coins === undefined) {
        console.log(`Failed to get coins of pool: ${pool}`)
        continue
      }

      const stakedPositionOfPool = await this.getUserStakedPositionInfoOfPool(userAddr, pool, gauger, coins[0], coins[1])
      res.push(...stakedPositionOfPool)
    }

    return res
  }

  async getUserStakedPositionInfoOfPool(userAddr: string, pool: string, gauger: string, poolCoinA: string, poolCoinB: string) {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)

    const typeArguments = [magma_token, poolCoinA, poolCoinB]

    const args = [tx.object(voter_id), tx.object(gauger), tx.object(pool), tx.pure.address(userAddr), tx.object(CLOCK_ADDRESS)]

    tx.moveCall({
      target: `${integrate.published_at}::${Gauge}::user_staked_position_infos`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const res: any[] = []
    simulateRes.events?.forEach((item: any) => {
      res.push(item.parsedJson)
    })

    return res
  }

  async getPoolGaguers() {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)

    const typeArguments = [magma_token]
    const args = [tx.object(voter_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${Voter}::pools_gauges`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const poolGauger = new Map<string, string>()
    simulateRes.events?.forEach((item: any) => {
      const { gauges } = item.parsedJson
      console.log('parsedJson', item.parsedJson)
      item.parsedJson.pools.map((pool: string, index: string) => {
        poolGauger.set(pool, gauges[index])
      })
    })

    // console.log('##### ', poolGauger)
    return poolGauger
  }

  async getPoolCoins(pools: string[]) {
    const res = await this._sdk.fullClient.multiGetObjects({ ids: pools, options: { showContent: true } })

    const poolCoins = new Map<string, string[]>()

    res.forEach((item) => {
      if (item.error != null || item.data?.content?.dataType !== 'moveObject') {
        throw new Error(`Failed to get poolCoins with err: ${item.error}`)
      }

      const type = getObjectType(item) as string
      const poolTypeFields = extractStructTagFromType(type)

      poolCoins.set(poolTypeFields.address, poolTypeFields.type_arguments)
    })
    return poolCoins
  }

  async getEmissions() {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, minter_id, voting_escrow_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)

    const typeArguments = [magma_token]

    const args = [tx.object(minter_id), tx.object(voting_escrow_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${Minter}::emissions`,
      arguments: args,
      typeArguments,
    })

    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    let res: EpochEmission = {
      emission: 0,
      rebase: 0,
    }
    simulateRes.events?.forEach((item: any) => {
      res = {
        emission: item.parsedJson.emission,
        rebase: item.parsedJson.rebase,
      }
    })

    return res
  }
}
