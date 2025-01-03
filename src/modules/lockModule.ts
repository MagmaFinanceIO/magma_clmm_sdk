import { Transaction } from '@mysten/sui/transactions'
import {
  CreateLockParams,
  IncreaseLockAmountParams,
  MergeLockParams,
  TransferLockParams,
  IncreaseUnlockTimeParams,
  LockPermanentParams,
  VoteParams,
} from 'src/types'
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

  async createCreateLockTransactionPayload(params: CreateLockParams): Promise<Transaction> {
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

  // /// Vote for gauges
  // public fun vote<T>(
  //     self: &mut Voter<T>,
  //     ve: &mut VotingEscrow<T>,
  //     lock: &Lock,
  //     pools: vector<ID>,
  //     weights: vector<u64>,
  //     clock: &Clock,
  //     ctx: &mut TxContext
  // )
  async votePayload(params: VoteParams): Promise<Transaction> {
    if (this._sdk.senderAddress.length === 0) {
      throw Error('this config sdk senderAddress is empty')
    }

    return TransactionUtil.buildVoteTransaction(this.sdk, params)
  }
}
