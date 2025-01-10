// const ProjectName: string = 'new-typescript-project'

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { initMagmaSDK } from './config'
import { VoteParams } from './types'

function buildTestAccount(): Ed25519Keypair {
  const mnemonics = 'change prison cube paddle nice basic dirt drum upper army middle panic'
  // const mnemonics =
  //   'drum arch mouse dilemma voyage reason man prefer cook turn naive spin beyond pave horn setup banner friend among pledge charge describe popular machine'
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

  // 1. Create lock
  const createLockPayload = await magmaClmmSDK.Lock.createLockTransactionPayload({
    amount: '1000000', // Decimal: 6
    lockDurationDays: 7,
    permanent: false,
  })
  const createLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, createLockPayload)
  console.log('CreateLockTxn #####: ', createLockTxn)

  // 2. Query all locks of user
  const locksOfUser = await magmaClmmSDK.Lock.locksOfUser(sendKeypair.getPublicKey().toSuiAddress())
  console.log('LocksOfUser #####: ', locksOfUser)

  // 2.1 Query again
  const locksOfUser2 = await magmaClmmSDK.Lock.locksOfUser('0xcc1017f624e7c1353432a116ecddf9490b335d351d17257eedd3206699ff4c0a')
  console.log('LocksOfUser2 #####: ', locksOfUser2)

  // 3. increase lock amount
  const increaseLockAmountPayload = await magmaClmmSDK.Lock.increaseLockAmountTransactionPayload({
    lockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
    amount: '1000000',
  })
  const increaseAmountTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, increaseLockAmountPayload)
  console.log('increaseAmountTxn #####: ', increaseAmountTxn)

  // 4. increase lock duration
  const increaseLockDurationPayload = await magmaClmmSDK.Lock.increaseUnlockTimePayload({
    lockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
    newLockEndAt: 1738195200,
  })
  const increaseLockDurationTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, increaseLockDurationPayload)
  console.log('increaseLockDurationPayload #####: ', increaseLockDurationTxn)

  // 5. merge
  const mergeLockPayload = await magmaClmmSDK.Lock.mergeLockTransactionPayload({
    fromLockId: '0x8f4a41956493b887dcacd8a8e03f381d1708292cf088a790eef5245fef227091',
    toLockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
  })
  const mergeLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, mergeLockPayload)
  console.log('mergeLockTxn #####: ', mergeLockTxn)

  // 6. transfer
  const transferLockPayload = await magmaClmmSDK.Lock.transferLockTransactionPayload({
    lockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
    to: '0xcc1017f624e7c1353432a116ecddf9490b335d351d17257eedd3206699ff4c0a',
  })
  const transferLockTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, transferLockPayload)
  console.log('transferLockTxn #####: ', transferLockTxn)

  // 7. lock_permanent
  const lockPermanentPayload = await magmaClmmSDK.Lock.lockPermanentPayload({
    lockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
  })
  const unlcokPermanentTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, lockPermanentPayload)
  console.log('lockPermanentPayload #####: ', unlcokPermanentTxn)

  // 8. unlock_permament
  const unlockPermanentPayload = await magmaClmmSDK.Lock.unlockPermanentPayload({
    lockId: '0x3142b6caa42dcffc62594bd0db7497ad419a5605b3e74b70292aef2d2b4e7616',
  })
  const unlockPermanentTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, unlockPermanentPayload)
  console.log('unlockPermanentPayload: #####', unlockPermanentTxn)

  // 9. vote
  const votePayload = await magmaClmmSDK.Lock.votePayload({
    lockId: '0x9cdfa3e8df2c556ec3c3c3d1f650cd54b31043f15a0872034347626a44715171',
    pools: ['0x74b8f3a5df409051a2b353f84bdc3b15a6e79342374077e83819b63a71c271c6'],
    weights: [1],
  })
  const voteTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, votePayload)
  console.log('voteTxn #####: ', voteTxn)

  const pool = await magmaClmmSDK.Pool.getPool('0x74b8f3a5df409051a2b353f84bdc3b15a6e79342374077e83819b63a71c271c6')
  const res = await magmaClmmSDK.Pool.fetchPositionRewardList({
    pool_id: '0x74b8f3a5df409051a2b353f84bdc3b15a6e79342374077e83819b63a71c271c6',
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
  })

  console.log('getPosition #####: ', res)

  // 10. claimVotingRewards
  const claimVotingRewardsPayload = await magmaClmmSDK.Lock.claimVotingRewardsPayload({
    coinAType: SuiAddressType
    coinBType: SuiAddressType
    locks: SuiObjectIdType[]
  })
  const claimVotingRewardsTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimVotingRewardsPayload)
  console.log('claimVotingRewardsTxn #####: ', claimVotingRewardsTxn)

  // 11. claimAndLockRebases
  const claimAndLockRebasesPayload = await magmaClmmSDK.Lock.claimAndLockRebasesPayload({
    lockId: '0x9cdfa3e8df2c556ec3c3c3d1f650cd54b31043f15a0872034347626a44715171',
  })
  const claimAndLockRebasesTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, claimAndLockRebasesPayload)
  console.log('claimAndLockRebasesTxn #####: ', claimAndLockRebasesTxn)

  // 12. poke
  const pokePayload = await magmaClmmSDK.Lock.pokePayload({
    lockId: '0x9cdfa3e8df2c556ec3c3c3d1f650cd54b31043f15a0872034347626a44715171',
  })
  const pokeTxn = await magmaClmmSDK.fullClient.sendTransaction(sendKeypair, pokePayload)
  console.log('pokeTxn #####: ', pokeTxn)
}

run_test()
