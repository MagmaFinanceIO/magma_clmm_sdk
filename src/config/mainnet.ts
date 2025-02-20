import { getFullnodeUrl } from '@mysten/sui/client'
import MagmaClmmSDK, { SdkOptions } from '../main'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0xfa145b9de10fe858be81edd1c6cdffcf27be9d016de02a1345eb1009a68ba8b2',
    global_config_id: '0x4c4e1402401f72c7d8533d0ed8d5f8949da363c7a3319ccef261ffe153d32f8a',
    global_vault_id: '0xa7e1102f222b6eb81ccc8a126e7feb2353342be9df6f6646a77c4519da29c071',
    admin_cap_id: '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
  },
  magmaConfig: {
    coin_list_id: '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
    launchpad_pools_id: '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
    clmm_pools_id: '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
    admin_cap_id: '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
    coin_list_handle: '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
    launchpad_pools_handle: '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
    clmm_pools_handle: '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',

    global_config_id: '0x4f32c00706e7bdbce532acdcfc0afd91b14defd5ffc9e2723a0ce7ed84f5d380',
    voter_id: '0xe8e0c266602404caa463f85bee4ccf6000c8c2566204a3949400a06857295ceb',
    voting_escrow_id: '0x143aab8c7c13c58a94d99ae281b4226f1877abc21bc01b9d75b58a7217fc3b2c',
    reward_distributor_id: '0x93bf24d3db08f93a02ba90abc7095f8d8086e5a1f72bac8bd866df21defe83ab',
    distribution_cfg: '0x94e23846c975e2faf89a61bfc2b10ad64decab9069eb1f9fc39752b010868c74',
    magma_token: '0x3abcdefce1a0ec1252237b69efc6dc3881325d543fceaad2e2f360a02d2f5bd9::magma_token::MAGMA_TOKEN',
    minter_id: '0x92877b638c3febf8576d0d7caebf9a2c43753b2e441669fb434e709458ece345',
  },
}

// mainnet
export const clmmMainnet: SdkOptions = {
  fullRpcUrl: getFullnodeUrl('mainnet'),
  simulationAccount: {
    address: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
  magma_config: {
    package_id: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
    published_at: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
    config: SDKConfig.magmaConfig,
  },
  clmm_pool: {
    package_id: '0x4a35d3dfef55ed3631b7158544c6322a23bc434fe4fca1234cb680ce0505f82d',
    published_at: '0x4a35d3dfef55ed3631b7158544c6322a23bc434fe4fca1234cb680ce0505f82d',
    config: SDKConfig.clmmConfig,
  },
  distribution: {
    package_id: '0x3abcdefce1a0ec1252237b69efc6dc3881325d543fceaad2e2f360a02d2f5bd9',
    published_at: '0x3abcdefce1a0ec1252237b69efc6dc3881325d543fceaad2e2f360a02d2f5bd9',
  },
  integrate: {
    package_id: '0x6e3ae31a16362c563c0fef5293348d262646882a10c307f20f6be8577960f1ef',
    published_at: '0x6e3ae31a16362c563c0fef5293348d262646882a10c307f20f6be8577960f1ef',
  },
  deepbook: {
    package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
  },
  deepbook_endpoint_v2: {
    package_id: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
    published_at: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
  },
  aggregatorUrl: 'https://api.magmafinance.io/api/router',
  swapCountUrl: 'https://api.magmafinance.io/api/v2/sui/swap/count',
}

/**
 * Initialize the mainnet SDK
 * @param fullNodeUrl. If provided, it will be used as the full node URL.
 * @param simulationAccount. If provided, it will be used as the simulation account address.
 * @returns
 */
export function initMainnetSDK(fullNodeUrl?: string, simulationAccount?: string): MagmaClmmSDK {
  if (fullNodeUrl) {
    clmmMainnet.fullRpcUrl = fullNodeUrl
  }
  if (simulationAccount) {
    clmmMainnet.simulationAccount.address = simulationAccount
  }
  return new MagmaClmmSDK(clmmMainnet)
}
