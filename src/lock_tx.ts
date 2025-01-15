import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { initMagmaSDK } from './config'
import { VoteParams } from './types'

function buildTestAccount(): Ed25519Keypair {
  const mnemonics = 'change prison cube paddle nice basic dirt drum upper army middle panic'
  const testAccountObject = Ed25519Keypair.deriveKeypair(mnemonics)
  // console.log(' Address: ', testAccountObject.getPublicKey().toSuiAddress())

  return testAccountObject
}

async function run_test() {
  const sendKeypair = buildTestAccount()
  const magmaClmmSDK = initMagmaSDK({
    network: 'mainnet',
    fullNodeUrl: 'http://192.168.3.64:9000',
    simulationAccount: sendKeypair.getPublicKey().toSuiAddress(),
  })
  magmaClmmSDK.senderAddress = sendKeypair.getPublicKey().toSuiAddress()
  const account2 = '0xcc1017f624e7c1353432a116ecddf9490b335d351d17257eedd3206699ff4c0a'

  // magmaClmmSDK.Lock.objectsOfUser(sendKeypair.getPublicKey().toSuiAddress())

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

  {
    // 2. Query all locks of user
    const locksOfUser = await magmaClmmSDK.Lock.locksOfUser(sendKeypair.getPublicKey().toSuiAddress())
    console.log('LocksOfUser #####: ', locksOfUser)

    // 2.1 Query again
    const locksOfUser2 = await magmaClmmSDK.Lock.locksOfUser(account2)
    console.log('LocksOfUser2 #####: ', locksOfUser2)
  }

  const lockId = '0x0d7b1e1a5fa583a251b2bd387d00415d22dcecb33615d614b4c81b8f3267a73a'
  const lockId2 = '0xaa5dede13aeff7d1930b92fa86c2144031487a03992b122538110ec0968aaaa5'
  const poolId = '0x4656653c187a22cc9384b3b25b695cbe6c1833300b80a50c9dd1c4522875da27'

  {
    // Summary of a lock
    const aLockSummary = await magmaClmmSDK.Lock.aLockSummary(lockId)
    console.log('summaryOfLock #####: ', aLockSummary)

    // FIXME: 2.0.1 All Lock summary
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
    // 13. 获取所有池子的votingPower: call pool_tally
    // Get PoolWeights:
    const poolWeights = await magmaClmmSDK.Lock.poolWeights([poolId])
    console.log('poolWeights: ', poolWeights)
  }

  {
    // 14. 获取奖励的token_list
    const votingFeeRewardTokens = await magmaClmmSDK.Lock.getVotingFeeRewardTokens(lockId)
    console.log('votintFeeRewardTokens #####: ', votingFeeRewardTokens)

    // 15. 获取池子的VotingFeeRewardToken
    const votingBribeRewardTokens = await magmaClmmSDK.Lock.getVotingBribeRewardTokens(lockId)
    console.log('votingBribeRewardTokens #####: ', votingBribeRewardTokens)

    // 16. 获得pool的incentive token list
    const poolBribeRewardTokens = await magmaClmmSDK.Lock.getPoolBribeRewardTokens(lockId)
    console.log('poolBribeRewardTokens #####: ', poolBribeRewardTokens)

    const incentiveTokens: string[] = []
    poolBribeRewardTokens.forEach((value, key) => {
      incentiveTokens.push(...value)
    })
    // 17. 获得pool 的incentive token奖励数量
    const poolIncentiveRewards = await magmaClmmSDK.Lock.getPoolIncentiveRewrads(incentiveTokens, lockId)
    console.log('poolIncentiveRewards #####: ', poolIncentiveRewards)
  }
}

run_test()
