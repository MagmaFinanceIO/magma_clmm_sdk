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
  total_supply: number | string
  total_locked: number | string
}

export type StakedPositionOfPool = {
  coin_type_a: string
  coin_type_b: string
  liquidity: string
  tick_lower_index: number
  tick_upper_index: number
  pos_object_id: string
  magma_distribution_staked: boolean
  pool: string
  earned: string
  name: string
}

export type GetRewardByPosition = {
  poolId: string
  gaugeId: string
  positionId: string
  coinTypeA: string
  coinTypeB: string
}
