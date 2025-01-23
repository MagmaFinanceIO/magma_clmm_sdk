import { getFullnodeUrl } from '@mysten/sui/client'
import MagmaClmmSDK, { SdkOptions } from '../main'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
    global_config_id: '0x4f32c00706e7bdbce532acdcfc0afd91b14defd5ffc9e2723a0ce7ed84f5d380',
    global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
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
    voter_id: '0x2e2fae39d85e991e1adad756f6723bb1aebc33140b8b16897a41171640389f88',
    voting_escrow_id: '0x8c300ccc0cb221feb76d0ed0820ff0873477ab1ada266129d594d539c5cd2f11',
    reward_distributor_id: '0x289c10f62e998a2ee58a982262732af7e329b7b689f4c81b0e16de7c6589669c',
    magma_token: '0x4201f44d506036666a1d9166f7a3450a80c73c551a582684cf39f2dbb3d56461::magma_token::MAGMA_TOKEN',
    minter_id: '0xfaf1c9b59192a3f910f28d46325dbfb3ffcc92df43d11663f3820fec8faf540b',
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
    package_id: '0x0a9b94307de472ebe7c1a24ea862eb013d954c9c003a0484e045861d05b31435',
    published_at: '0x0a9b94307de472ebe7c1a24ea862eb013d954c9c003a0484e045861d05b31435',
    config: SDKConfig.clmmConfig,
  },
  distribution: {
    package_id: '0x4201f44d506036666a1d9166f7a3450a80c73c551a582684cf39f2dbb3d56461',
    published_at: '0x5c008a2e0aee9a034b19e32bbc119cf6e7b1a0ce1316b2199cde1704d9f64f3c',
  },
  integrate: {
    package_id: '0x01268a2afbaf91538f0b9041269fe2780273eb83b642abd4fcacad7b660a3711',
    published_at: '0x01268a2afbaf91538f0b9041269fe2780273eb83b642abd4fcacad7b660a3711',
  },
  deepbook: {
    package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
  },
  deepbook_endpoint_v2: {
    package_id: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
    published_at: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
  },
  aggregatorUrl: 'https://api-sui.magma.zone/router',
  swapCountUrl: 'https://api-sui.magma.zone/v2/sui/swap/count',
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
