import { Transaction } from '@mysten/sui/transactions'
import {
  CreateLockParams,
  IncreaseLockAmountParams,
  MergeLockParams,
  TransferLockParams,
  IncreaseUnlockTimeParams,
  LockPermanentParams,
  VoteParams,
  ClaimFeesParams as ClaimVotingRewardsParams,
  ClaimFeesPoolsParams as ClaimVotingRewardsPoolsParams,
  ClaimAndLockParams,
  PokeParams,
  VotingEscrow,
  CLOCK_ADDRESS,
  getPackagerConfigs,
  Voter,
} from '../types'
import { checkInvalidSuiAddress, extractStructTagFromType } from '../utils'
import { IModule } from '../interfaces/IModule'
import { MagmaClmmSDK } from '../sdk'
import { TransactionUtil } from '../utils/transaction-util'

type LocksInfo = {
  owner: string
  lockInfo: LockInfo[]
}

type AllLockSummary = {
  current_epoch_end: number
  current_epoch_vote_end: number
  rebase_apr: number
  team_emission_rate: number
  total_locked: number
  total_voted_power: number
  total_voting_power: number
}

type LockInfo = {
  lock_id: string
  amount: string
  start: string
  end: string
  permanent: boolean

  rebase_amount: Coin
  voting_power: string
  voting_rewards: Map<string, Coin[]> // pool => incentiveTokenAmount
}

type Coin = {
  kind?: CoinType
  token_addr: string
  amount: string
}

enum CoinType {
  RebaseCoin = 'rebaseCoin',
  Fee = 'fee',
  Incentive = 'incentiveCoin',
}

type PoolWeight = {
  poolId: string
  weight: string
}

type ALockSummary = {
  fee_incentive_total: string
  reward_distributor_claimable: string
  voting_power: string
}

export class LockModule implements IModule {
  protected _sdk: MagmaClmmSDK

  constructor(sdk: MagmaClmmSDK) {
    this._sdk = sdk
  }

  get sdk() {
    return this._sdk
  }

  async createLockTransactionPayload(params: CreateLockParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }
    const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)

    return TransactionUtil.buildCreateLockTransaction(this.sdk, params, allCoinAsset)
  }

  async increaseLockAmountTransactionPayload(params: IncreaseLockAmountParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }
    const allCoinAsset = await this._sdk.getOwnerCoinAssets(this._sdk.senderAddress)

    return TransactionUtil.buildIncreaseLockAmountTransaction(this.sdk, params, allCoinAsset)
  }

  async mergeLockTransactionPayload(params: MergeLockParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildMergeLockTransaction(this.sdk, params)
  }

  // public fun transfer<T>(lock: Lock, ve: &mut VotingEscrow<T>, to: address, clock: &Clock, ctx: &mut TxContext) {
  async transferLockTransactionPayload(params: TransferLockParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildTransferLockTransaction(this.sdk, params)
  }

  async increaseUnlockTimePayload(params: IncreaseUnlockTimeParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildIncreaseUnlockTimeTransaction(this.sdk, params)
  }

  // public fun lock_permanent<T>(self: &mut VotingEscrow<T>, lock: &mut Lock, clock: &Clock, ctx: &mut TxContext) {
  async lockPermanentPayload(params: LockPermanentParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildLockPermanentTransaction(this.sdk, params)
  }

  async unlockPermanentPayload(params: LockPermanentParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildUnlockPermanentTransaction(this.sdk, params)
  }

  async votePayload(params: VoteParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildVoteTransaction(this.sdk, params)
  }

  // public fun claim_fees<T, B>(self: &mut Voter<T>, ve: &mut VotingEscrow<T>, mut locks: vector<Lock>, clock: &Clock, ctx: &mut TxContext) {
  async claimVotingRewardsPayload(params: ClaimVotingRewardsParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildClaimVotingRewardsTransaction(this.sdk, params)
  }

  // public fun claim_fees<T, B>(self: &mut Voter<T>, ve: &mut VotingEscrow<T>, mut locks: vector<Lock>, clock: &Clock, ctx: &mut TxContext) {
  async claimVotingRewardsPoolsPayload(params: ClaimVotingRewardsPoolsParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildClaimVotingRewardsPoolsTransaction(this.sdk, params)
  }

  async claimAndLockRebasesPayload(params: ClaimAndLockParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }
    return TransactionUtil.buildClaimAndLockRebases(this.sdk, params)
  }

  async pokePayload(params: PokeParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }
    return TransactionUtil.buildPoke(this.sdk, params)
  }

  async claimVotingBribe(locks: string[], incentive_tokens: string[]): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }
    return TransactionUtil.buildClaimVotingBribe(this.sdk, locks, incentive_tokens)
  }

  async locksOfUser(user: string): Promise<LocksInfo> {
    const locksInfo: LocksInfo = { owner: user, lockInfo: [] }
    const { distribution } = this._sdk.sdkOptions //  getPackagerConfigs(this._sdk.sdkOptions.magma_config)
    const { magma_token } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)

    // all objects
    const ownerRes = await this._sdk.fullClient.getOwnedObjectsByPage(user, {
      options: { showType: true, showContent: true, showDisplay: true, showOwner: true },
      filter: {
        MatchAll: [{ Package: distribution.package_id }, { StructType: `${distribution.package_id}::voting_escrow::Lock` }],
      },
    })

    for (const item of ownerRes.data as any[]) {
      const { fields } = item.data.content

      const aLockSummary = await this.aLockSummary(fields.id.id)
      const poolIncentiveTokens = await this.getVotingBribeRewardTokens(fields.id.id)

      const incentiveTokens: string[] = []
      poolIncentiveTokens.forEach((value, key) => {
        incentiveTokens.push(...value)
      })

      // coin => pool => amount
      const poolIncentiveRewards = await this.getPoolIncentiveRewrads(incentiveTokens, fields.id.id)
      const votingRewards = new Map<string, Coin[]>() // pool => rewardTokens
      poolIncentiveRewards.forEach((value, coin) => {
        value.forEach((amount, pool) => {
          if (!votingRewards.has(pool)) {
            votingRewards.set(pool, [])
          }
          votingRewards.get(pool)?.push({
            kind: CoinType.Incentive,
            token_addr: coin,
            amount: amount.toString(),
          })
        })
      })

      const lockInfo: LockInfo = {
        lock_id: fields.id.id,
        amount: fields.amount,
        start: fields.start,
        end: fields.end,
        permanent: fields.permanent,

        rebase_amount: {
          kind: CoinType.RebaseCoin,
          token_addr: magma_token,
          amount: aLockSummary.reward_distributor_claimable,
        },
        voting_power: aLockSummary.voting_power,
        // pool => incentive => amount
        voting_rewards: votingRewards,
      }

      locksInfo.lockInfo.push(lockInfo)
    }
    return locksInfo
  }

  async aLockInfo(lockId: string): Promise<LockInfo> {
    const aLockSummary = await this.aLockSummary(lockId)
    const lockObj = await this._sdk.fullClient.getObject({
      id: lockId,
      options: {
        showContent: true,
        showDisplay: true,
        showOwner: true,
        showPreviousTransaction: true,
        showStorageRebate: true,
        showType: true,
      },
    })
    const { magma_token } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)

    const poolIncentiveTokens = await this.getVotingBribeRewardTokens(lockId)

    const incentiveTokens: string[] = []
    poolIncentiveTokens.forEach((value, key) => {
      incentiveTokens.push(...value)
    })

    const poolIncentiveRewards = await this.getPoolIncentiveRewrads(incentiveTokens, lockId)
    const votingRewards = new Map<string, Coin[]>() // pool => rewardTokens
    poolIncentiveRewards.forEach((value, coin) => {
      value.forEach((amount, pool) => {
        if (!votingRewards.has(pool)) {
          votingRewards.set(pool, [])
        }
        votingRewards.get(pool)?.push({
          kind: CoinType.Incentive,
          token_addr: coin,
          amount: amount.toString(),
        })
      })
    })

    const lockObjFields = lockObj.data.content.fields
    const lockInfo: LockInfo = {
      lock_id: lockId,
      amount: lockObjFields.amount,
      start: lockObjFields.start,
      end: lockObjFields.end,
      permanent: lockObjFields.permanent,

      rebase_amount: {
        kind: CoinType.RebaseCoin,
        token_addr: magma_token,
        amount: aLockSummary.reward_distributor_claimable,
      },
      voting_power: aLockSummary.voting_power,
      voting_rewards: votingRewards,
    }
    return lockInfo
  }

  async aLockSummary(lock_id: string): Promise<ALockSummary> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { voting_escrow_id, magma_token, voter_id, reward_distributor_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const args = [
      tx.object(voter_id),
      tx.object(voting_escrow_id),
      tx.object(reward_distributor_id),
      tx.object(lock_id),
      tx.object(CLOCK_ADDRESS),
    ]

    tx.moveCall({
      target: `${integrate.published_at}::${VotingEscrow}::lock_summary`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    let res: ALockSummary = {
      //  reward_distributor_claimable + incentive magma
      fee_incentive_total: '',
      // How much Magma can be claimed
      reward_distributor_claimable: '',

      voting_power: '',
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `LockSummary`) {
        res = {
          fee_incentive_total: item.parsedJson.fee_incentive_total,
          reward_distributor_claimable: item.parsedJson.reward_distributor_claimable,
          voting_power: item.parsedJson.voting_power,
        }
      }
    })
    return res
  }

  async allLockSummary(): Promise<AllLockSummary> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { voting_escrow_id, magma_token, voter_id, minter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const args = [tx.object(minter_id), tx.object(voter_id), tx.object(voting_escrow_id), tx.object(CLOCK_ADDRESS)]

    tx.moveCall({
      target: `${integrate.published_at}::${VotingEscrow}::summary`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    let summary: AllLockSummary = {
      current_epoch_end: 0,
      current_epoch_vote_end: 0,
      rebase_apr: 0,
      team_emission_rate: 0,
      total_locked: 0,
      total_voted_power: 0,
      total_voting_power: 0,
    }
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `Summary`) {
        summary = {
          current_epoch_end: Number(item.parsedJson.current_epoch_end),
          current_epoch_vote_end: Number(item.parsedJson.current_epoch_vote_end),
          rebase_apr: Number(item.parsedJson.rebase_apr),
          team_emission_rate: Number(item.parsedJson.team_emission_rate),
          total_locked: Number(item.parsedJson.total_locked),
          total_voted_power: Number(item.parsedJson.total_voted_power),
          total_voting_power: Number(item.parsedJson.total_voting_power),
        }
      }
    })
    return summary
  }

  async poolWeights(pools: string[]): Promise<PoolWeight[]> {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const poolsParams = tx.pure.vector('id', pools)
    const args = [tx.object(voter_id), poolsParams]

    tx.moveCall({
      target: `${integrate.published_at}::${Voter}::pools_tally`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const poolWeights: PoolWeight[] = []
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `PoolsTally`) {
        item.parsedJson.list.forEach((item: any) => {
          poolWeights.push({
            poolId: item.id,
            weight: item.weight,
          })
        })
      }
    })
    return poolWeights
  }

  async getVotingFeeRewardTokens(lock_id: string) {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const args = [tx.object(voter_id), tx.object(lock_id)]

    tx.moveCall({
      target: `${integrate.published_at}::${Voter}::get_voting_fee_reward_tokens`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const poolRewardTokens = new Map<string, string[]>()
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventRewardTokens`) {
        item.parsedJson.list.contents.forEach((poolTokens: any) => {
          if (!poolRewardTokens.has(poolTokens.key)) {
            poolRewardTokens.set(poolTokens.key, [])
          }

          poolTokens.value.forEach((token: any) => {
            poolRewardTokens.get(poolTokens.key)?.push(token.name)
          })
        })
      }
    })
    return poolRewardTokens
  }

  async getVotingBribeRewardTokens(lock_id: string) {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const args = [tx.object(voter_id), tx.object(lock_id)]
    tx.moveCall({
      target: `${integrate.published_at}::${Voter}::get_voting_bribe_reward_tokens`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const poolBirbeRewardTokens = new Map<string, string[]>()
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventRewardTokens`) {
        item.parsedJson.list.contents.forEach((poolTokens: any) => {
          if (!poolBirbeRewardTokens.has(poolTokens.key)) {
            poolBirbeRewardTokens.set(poolTokens.key, [])
          }

          poolTokens.value.forEach((token: any) => {
            poolBirbeRewardTokens.get(poolTokens.key)?.push(token.name)
          })
        })
      }
    })
    return poolBirbeRewardTokens
  }

  // tokenId => pool => incentive_tokens
  async getPoolIncentiveRewrads(incentive_tokens: string[], locksId: string) {
    // tokenId => pool => incentive_tokens
    const poolBirbeRewardTokens = new Map<string, Map<string, string>>()
    if (incentive_tokens.length === 0) {
      return poolBirbeRewardTokens
    }

    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token, ...incentive_tokens]

    const args = [tx.object(voter_id), tx.object(locksId), tx.object(CLOCK_ADDRESS)]
    let targetFunc = `${integrate.published_at}::${Voter}::claimable_voting_bribes_${incentive_tokens.length}`
    if (incentive_tokens.length === 1) {
      targetFunc = `${integrate.published_at}::${Voter}::claimable_voting_bribes`
    }

    tx.moveCall({
      target: targetFunc,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `ClaimableVotingBribes`) {
        item.parsedJson.data.contents.forEach((rewardTokens: any) => {
          if (!poolBirbeRewardTokens.has(rewardTokens.key.name)) {
            poolBirbeRewardTokens.set(rewardTokens.key.name, new Map<string, string>())
          }

          rewardTokens.value.contents.forEach((token: any) => {
            poolBirbeRewardTokens.get(rewardTokens.key.name)?.set(token.key, token.value)
          })
        })
      }
    })
    return poolBirbeRewardTokens
  }

  async getPoolBribeRewardTokens(pool_id: string) {
    const tx = new Transaction()
    const { integrate, simulationAccount } = this.sdk.sdkOptions
    const { magma_token, voter_id } = getPackagerConfigs(this.sdk.sdkOptions.magma_config)
    const typeArguments = [magma_token]

    const args = [tx.object(voter_id), tx.object(pool_id)]
    tx.moveCall({
      target: `${integrate.published_at}::${Voter}::get_voting_bribe_reward_tokens_by_pool`,
      arguments: args,
      typeArguments,
    })

    if (!checkInvalidSuiAddress(simulationAccount.address)) {
      throw Error('this config simulationAccount is not set right')
    }
    const simulateRes = await this.sdk.fullClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: simulationAccount.address,
    })

    if (simulateRes.error != null) {
      throw new Error(`all_lock_summary error code: ${simulateRes.error ?? 'unknown error'}`)
    }

    const poolBirbeRewardTokens = new Map<string, string[]>()
    simulateRes.events?.forEach((item: any) => {
      if (extractStructTagFromType(item.type).name === `EventRewardTokens`) {
        item.parsedJson.list.contents.forEach((poolTokens: any) => {
          if (!poolBirbeRewardTokens.has(poolTokens.key)) {
            poolBirbeRewardTokens.set(poolTokens.key, [])
          }

          poolTokens.value.forEach((token: any) => {
            poolBirbeRewardTokens.get(poolTokens.key)?.push(token.name)
          })
        })
      }
    })
    return poolBirbeRewardTokens
  }
}
