import { SuiAddressType, SuiObjectIdType } from './sui'

// self: &mut VotingEscrow<T>,
// coin: Coin<T>,
// lock_duration: u64,
// permanent: bool,
// clock: &Clock, Use CLOCK_ADDRESS
// ctx: &mut TxContext

export type CreateLockParams = {
  // &mut VotingEscrow<T>, // T should be MagmaToken

  /**
   * The address type of the coin.
   */
  coinType: SuiAddressType

  /**
   * The swap amount.
   */
  amount: string

  /**
   * How long the lock will last.
   */
  lock_duration: number

  /**
   * If the lock is permanent.
   */
  permanent: boolean

  // clock: &Clock, Use CLOCK_ADDRESS
}

// increase_amount<T>(self: &mut VotingEscrow<T>, lock: &mut Lock, coin_t: Coin<T>, clock: &Clock, ctx: &mut TxContext)
export type IncreaseLockAmountParams = {
  lock_id: SuiObjectIdType

  /**
   * The address type of the coin.
   */
  coinType: SuiAddressType

  /**
   * The swap amount.
   */
  amount: string
}

// public fun merge<T>(self: &mut VotingEscrow<T>, from_lock: Lock, to_lock: &mut Lock, clock: &Clock, ctx: &mut TxContext) {
export type MergeLockParams = {
  from_lock_id: SuiObjectIdType

  to_lock_id: SuiObjectIdType
}

// public fun transfer<T>(lock: Lock, ve: &mut VotingEscrow<T>, to: address, clock: &Clock, ctx: &mut TxContext) {
export type TransferLockParams = {
  lock_id: SuiObjectIdType

  to: string
}

// public fun increase_unlock_time<T>(self: &mut VotingEscrow<T>, lock: &mut Lock, lock_duration: u64, clock: &Clock, ctx: &mut TxContext) {
export type IncreaseUnlockTimeParams = {
  lock_id: SuiObjectIdType

  /**
   * How long the lock will last.
   */
  lock_duration: number
}

// public fun lock_permanent<T>(self: &mut VotingEscrow<T>, lock: &mut Lock, clock: &Clock, ctx: &mut TxContext) {
export type LockPermanentParams = {
  lock_id: SuiObjectIdType
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
export type VoteParams = {
  lock_id: SuiObjectIdType

  pools: SuiObjectIdType[]

  weights: number[]
}
