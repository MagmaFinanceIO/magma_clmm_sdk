import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import BN from 'bn.js'
import { initMagmaSDK } from './config'
import { adjustForSlippage, Percentage } from './math'
import { d } from './utils'

function buildTestAccount(): Ed25519Keypair {
  const mnemonics = 'change prison cube paddle nice basic dirt drum upper army middle panic'
  const testAccountObject = Ed25519Keypair.deriveKeypair(mnemonics)
  // console.log(' Address: ', testAccountObject.getPublicKey().toSuiAddress())

  return testAccountObject
}

async function run_test() {
  const sendKeypair = buildTestAccount()
  const magmaClmmSDK = initMagmaSDK({
    network: 'testnet',
    // fullNodeUrl: 'http://192.168.3.64:9000',
    simulationAccount: sendKeypair.getPublicKey().toSuiAddress(),
  })
  magmaClmmSDK.senderAddress = sendKeypair.getPublicKey().toSuiAddress()
  const account2 = '0xcc1017f624e7c1353432a116ecddf9490b335d351d17257eedd3206699ff4c0a'

  {
    // 1. Create lock
    const createLockPayload = await magmaClmmSDK.Lock.createLockTransactionPayload({
      amount: '1000000', // Decimal: 6
      lockDurationDays: 7,
      permanent: false,
    })
    const createLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, createLockPayload)
    console.log('CreateLockTxn #####: ', createLockTxn)
  }

  const lockId = '0x7d91aab31e4510fb832fea3f9d875c6b374a9a9847622f6fef74cc13b6469c2e'
  const lockId2 = '0xf996458669e811f9f1b19a4016e481ce4c1a7e4074b940b857c905c527e99435'
  const poolId = '0x1a63b0cd9ddc99bb5767724cb778db54431b3a83ac1b4e14d49df72d83adbf74'

  {
    // 2. Query all locks of user
    const locksOfUser = await magmaClmmSDK.Lock.locksOfUser(sendKeypair.getPublicKey().toSuiAddress())
    console.log('LocksOfUser #####: ', locksOfUser)

    // 2.1 Query again
    const locksOfUser2 = await magmaClmmSDK.Lock.locksOfUser(account2)
    console.log('LocksOfUser2 #####: ', locksOfUser2)
  }

  {
    // LockInfo
    const lockInfo = await magmaClmmSDK.Lock.aLockInfo(lockId)
    console.log('summaryOfLock #####: ', lockInfo)

    // Summary of a lock
    const aLockSummary = await magmaClmmSDK.Lock.aLockSummary(lockId)
    console.log('summaryOfLock #####: ', aLockSummary)

    // All Lock summary
    const allLockSummary = await magmaClmmSDK.Lock.allLockSummary()
    console.log('summaryOfAllLock #####: ', allLockSummary)
  }

  {
    // 3. increase lock amount
    const increaseLockAmountPayload = await magmaClmmSDK.Lock.increaseLockAmountTransactionPayload({
      lockId,
      amount: '1000000',
    })
    const increaseAmountTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, increaseLockAmountPayload)
    console.log('increaseAmountTxn #####: ', increaseAmountTxn)
  }

  {
    // 4. increase lock duration
    const increaseLockDurationPayload = await magmaClmmSDK.Lock.increaseUnlockTimePayload({
      lockId,
      newLockEndAt: Date.now() + 10 * 3600 * 24,
    })
    const increaseLockDurationTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, increaseLockDurationPayload)
    console.log('increaseLockDurationPayload #####: ', increaseLockDurationTxn)
  }

  {
    // 5. merge
    const mergeLockPayload = await magmaClmmSDK.Lock.mergeLockTransactionPayload({
      fromLockId: lockId2,
      toLockId: lockId,
    })
    const mergeLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, mergeLockPayload)
    console.log('mergeLockTxn #####: ', mergeLockTxn)
  }

  {
    // 6. transfer
    const transferLockPayload = await magmaClmmSDK.Lock.transferLockTransactionPayload({
      lockId: lockId2,
      to: account2,
    })
    const transferLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, transferLockPayload)
    console.log('transferLockTxn #####: ', transferLockTxn)
  }

  {
    // 7. lock_permanent
    const lockPermanentPayload = await magmaClmmSDK.Lock.lockPermanentPayload({
      lockId,
    })
    const unlcokPermanentTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, lockPermanentPayload)
    console.log('lockPermanentPayload #####: ', unlcokPermanentTxn)
  }

  {
    // 8. unlock_permament
    const unlockPermanentPayload = await magmaClmmSDK.Lock.unlockPermanentPayload({
      lockId,
    })
    const unlockPermanentTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, unlockPermanentPayload)
    console.log('unlockPermanentPayload: #####', unlockPermanentTxn)
  }

  {
    // 9. lock vote pools
    const votePayload = await magmaClmmSDK.Lock.votePayload({
      lockId,
      pools: [poolId],
      weights: [1],
    })
    const voteTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, votePayload)
    console.log('voteTxn #####: ', voteTxn)
  }

  const pool = await magmaClmmSDK.Pool.getPool(poolId)
  {
    // 10.1. claimVotingRewards: multi locks
    const claimVotingRewardsPayload1 = await magmaClmmSDK.Lock.claimVotingRewardsPoolsPayload({
      coinAType: pool.coinTypeA,
      coinBType: pool.coinTypeB,
      locks: [lockId],
    })
    const claimVotingRewardsTxn1 = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimVotingRewardsPayload1)
    console.log('claimVotingRewardsTxn #####: ', claimVotingRewardsTxn1)
  }

  {
    // 10.2. claimVotingRewards: one lock
    const claimVotingRewardsPayload = await magmaClmmSDK.Lock.claimVotingRewardsPayload({
      coinAType: pool.coinTypeA,
      coinBType: pool.coinTypeB,
      locks: lockId,
    })
    const claimVotingRewardsTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimVotingRewardsPayload)
    console.log('claimVotingRewardsTxn #####: ', claimVotingRewardsTxn)
  }

  {
    // 11. claimAndLockRebases
    const claimAndLockRebasesPayload = await magmaClmmSDK.Lock.claimAndLockRebasesPayload({
      lockId,
    })
    const claimAndLockRebasesTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimAndLockRebasesPayload)
    console.log('claimAndLockRebasesTxn #####: ', claimAndLockRebasesTxn)
  }

  {
    // 12. poke
    const pokePayload = await magmaClmmSDK.Lock.pokePayload({
      lockId,
    })
    const pokeTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, pokePayload)
    console.log('pokeTxn #####: ', pokeTxn)
  }

  {
    // 13. Get all pools' votingPower: call pool_tally
    // Get PoolWeights:
    const poolWeights = await magmaClmmSDK.Lock.poolWeights([poolId])
    console.log('poolWeights: ', poolWeights)
  }

  {
    // 14. get reward token_list
    const votingFeeRewardTokens = await magmaClmmSDK.Lock.getVotingFeeRewardTokens(lockId)
    console.log('votintFeeRewardTokens #####: ', votingFeeRewardTokens)

    // 15. get pools VotingFeeRewardToken
    const votingBribeRewardTokens = await magmaClmmSDK.Lock.getVotingBribeRewardTokens(lockId)
    console.log('votingBribeRewardTokens #####: ', votingBribeRewardTokens)

    // 16. get pool's incentive token list
    const poolBribeRewardTokens = await magmaClmmSDK.Lock.getPoolBribeRewardTokens(poolId)
    console.log('poolBribeRewardTokens #####: ', poolBribeRewardTokens)

    const incentiveTokens: string[] = []
    poolBribeRewardTokens.forEach((value, key) => {
      incentiveTokens.push(...value)
    })
    // 17. Get pool's incentive token reward amount
    const poolIncentiveRewards = await magmaClmmSDK.Lock.getPoolIncentiveRewards(lockId, incentiveTokens)
    console.log('poolIncentiveRewards #####: ', poolIncentiveRewards)

    {
      // 18. claim voting incentive/bribe tokens
      const claimVotingBribePayload = await magmaClmmSDK.Lock.claimVotingBribe([lockId], incentiveTokens)
      const claimVotingBribeTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimVotingBribePayload)
      console.log('claimVotingRewardsTxn #####: ', claimVotingBribeTxn)
    }
  }
}

async function test_panter() {
  const sendKeypair = Ed25519Keypair.fromSecretKey('')

  const magmaClmmSDK = initMagmaSDK({
    network: 'mainnet',
    simulationAccount: sendKeypair.getPublicKey().toSuiAddress(),
  })
  magmaClmmSDK.senderAddress = sendKeypair.getPublicKey().toSuiAddress()

  // Whether the swap direction is token a to token b
  const a2b = false
  // fix input token amount
  const coinAmount = new BN(50000000)
  // input token amount is token a
  const byAmountIn = true
  // slippage value
  const slippage = Percentage.fromDecimal(d(5))
  // Fetch pool data
  const pool = await magmaClmmSDK.Pool.getPool('0x0128aade80123e3f6c5c0eac1a2dee2512bbdc92c9c1b386b0fd66e6cddfaa72')
  // Estimated amountIn amountOut fee
  const res: any = await magmaClmmSDK.Swap.preswap({
    pool,
    currentSqrtPrice: pool.current_sqrt_price,
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    decimalsA: 9,
    decimalsB: 9,
    a2b,
    byAmountIn,
    amount: coinAmount.toString(),
  })

  const partner = '0x5df5e1d4f8d449622a5fdeaa03f9029e8eb6b0eddd25c5a67543ee5a520b7003'

  // build swap Payload
  const swapPayload = await magmaClmmSDK.Swap.createSwapTransactionPayload({
    pool_id: pool.poolAddress,
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    a2b,
    by_amount_in: byAmountIn,
    amount: res.amount.toString(),
    amount_limit: '1',
    swap_partner: partner,
  })

  const transferTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, swapPayload)
  console.log('swap: ', transferTxn)
}

async function pool_gauge() {
  const magmaClmmSDK = initMagmaSDK({
    network: 'mainnet',
    // fullNodeUrl: 'http://192.168.3.64:9000',
    simulationAccount: '',
  })
  const res = await magmaClmmSDK.Gauge.getPoolGaguers()
  console.log('poolGauges: ', res)

  const pools = [
    '0x3c8d067cb266071bee84e60ca249257e9966ef5be42bd8cafb2c2f59402bc4c5',
    '0x8faa061cbec3a3208255f1c4d00f97fc6e542807d259d931d3af4a02ccdbe3fe',
  ]
  const pool_coins = await magmaClmmSDK.Gauge.getPoolCoins(pools)

  // magmaClmmSDK.Lock.addBribeReward(params)
}

// test_panter()
run_test()

pool_gauge()
