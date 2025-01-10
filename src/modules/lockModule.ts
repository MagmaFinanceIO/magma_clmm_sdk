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
  ClaimAndLockParams,
  PokeParams,
} from 'src/types'
import { getPackagerConfigs } from '../types'
import { IModule } from '../interfaces/IModule'
import { MagmaClmmSDK } from '../sdk'
import { TransactionUtil } from '../utils/transaction-util'

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

  async locksOfUser(user: string): Promise<LocksInfo> {
    const locksInfo: LocksInfo = { owner: user, lockInfo: [] }
    const { distribution_package_id } = getPackagerConfigs(this._sdk.sdkOptions.magma_config)

    // all objects
    const ownerRes = await this._sdk.fullClient.getOwnedObjectsByPage(user, {
      options: { showType: true, showContent: true, showDisplay: true, showOwner: true },
      filter: {
        MatchAll: [{ Package: distribution_package_id }, { StructType: `${distribution_package_id}::voting_escrow::Lock` }],
      },
    })

    for (const item of ownerRes.data as any[]) {
      const { fields } = item.data.content
      locksInfo.lockInfo.push({
        lock_id: fields.id.id,
        amount: fields.amount,
        start: fields.start,
        end: fields.end,
        permanent: fields.permanent,
      })
    }
    return locksInfo
  }

  // // FIXME: SuiEventFilter `And` or `All` not working
  // async locksOfUser(user: string): Promise<LocksInfo> {
  //   const { distribution_package_id } = getPackagerConfigs(this._sdk.sdkOptions.magma_config)

  //   const ids: SuiObjectIdType[] = []
  //   const eventFilter: SuiEventFilter = {
  //     MoveEventType: `${distribution_package_id}::voting_escrow::EventCreateLock`,
  //   }

  //   // 1. Fetch create locks events
  //   const events = await this._sdk.fullClient.queryEventsByPage(eventFilter)

  //   events.data.forEach((event) => {
  //     const fields = event.parsedJson
  //     if (fields && fields.owner === user) {
  //       ids.push(fields.lock_id)
  //     }
  //   })

  //   const locksInfo: LocksInfo = { owner: user, lockInfo: [] }
  //   const objects = await this._sdk.fullClient.batchGetObjects(ids, { showContent: true })

  //   objects.forEach((object) => {
  //     if ('data' in object) {
  //       const fields = getObjectFields(object)
  //       locksInfo.lockInfo.push({
  //         lock_id: fields.id.id,
  //         amount: fields.amount,
  //         start: fields.start,
  //         end: fields.end,
  //         permanent: fields.permanent,
  //       })
  //     }
  //   })
  //   return locksInfo
  // }
}

type LocksInfo = {
  owner: string
  lockInfo: LockInfo[]
}

type LockInfo = {
  lock_id: string
  amount: string
  start: string
  end: string
  permanent: boolean
}
