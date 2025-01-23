import { getFullnodeUrl } from '@mysten/sui/client'
import MagmaClmmSDK, { SdkOptions } from '../main'

const SDKConfig = {
  clmmConfig: {
    pools_id: '0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2',
    global_config_id: '0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e',
    global_vault_id: '0xf78d2ee3c312f298882cb680695e5e8c81b1d441a646caccc058006c2851ddea',
    admin_cap_id: '0xa456f86a53fc31e1243f065738ff1fc93f5a62cc080ff894a0fb3747556a799b',
  },
  magmaConfig: {
    coin_list_id: '0x257eb2ba592a5480bba0a97d05338fab17cc3283f8df6998a0e12e4ab9b84478',
    launchpad_pools_id: '0xdc3a7bd66a6dcff73c77c866e87d73826e446e9171f34e1c1b656377314f94da',
    clmm_pools_id: '0x26c85500f5dd2983bf35123918a144de24e18936d0b234ef2b49fbb2d3d6307d',
    admin_cap_id: '0x1a496f6c67668eb2c27c99e07e1d61754715c1acf86dac45020c886ac601edb8',
    coin_list_handle: '0x3204350fc603609c91675e07b8f9ac0999b9607d83845086321fca7f469de235',
    launchpad_pools_handle: '0xae67ff87c34aceea4d28107f9c6c62e297a111e9f8e70b9abbc2f4c9f5ec20fd',
    clmm_pools_handle: '0xd28736923703342b4752f5ed8c2f2a5c0cb2336c30e1fed42b387234ce8408ec',

    global_config_id: '0xbbe54f3c2bd06c5ab7f93950025bff6710c9a83836d7145636fea383b315774d',
    voter_id: '0x59571991a5c7041c4376d980061af5c7a6d8345006d6b5167bd1f00fc17b8ddb',
    voting_escrow_id: '0x9081c8044719135da4ff2d52907fcd40c19e2a40750cbba4c1d6a59610ae1446',
    reward_distributor_id: '0xdf213d8e0ca49c8f4a508e7d3b3a6983c4aafd639f7c99479fc75fb4451d752e',
    magma_token: '0x45ac2371c33ca0df8dc784d62c8ce5126d42edd8c56820396524dff2ae0619b1::magma_token::MAGMA_TOKEN',
    minter_id: '0x89435d6b2a510ba50ca23303f10e91ec058f138a88f69a43fe03cd22edb214c5',
  },
}

export const clmmTestnet: SdkOptions = {
  fullRpcUrl: getFullnodeUrl('testnet'),

  magma_config: {
    package_id: '0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca',
    published_at: '0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca',
    config: SDKConfig.magmaConfig,
  },
  clmm_pool: {
    package_id: '0x23e0b5ab4aa63d0e6fd98fa5e247bcf9b36ad716b479d39e56b2ba9ff631e09d',
    published_at: '0x23e0b5ab4aa63d0e6fd98fa5e247bcf9b36ad716b479d39e56b2ba9ff631e09d',
    config: SDKConfig.clmmConfig,
  },
  distribution: {
    package_id: '0x45ac2371c33ca0df8dc784d62c8ce5126d42edd8c56820396524dff2ae0619b1',
    published_at: '0x45ac2371c33ca0df8dc784d62c8ce5126d42edd8c56820396524dff2ae0619b1',
  },
  integrate: {
    package_id: '0x6d225cd7b90ca74b13e7de114c6eba2f844a1e5e1a4d7459048386bfff0d45df',
    published_at: '0x6d225cd7b90ca74b13e7de114c6eba2f844a1e5e1a4d7459048386bfff0d45df',
  },

  simulationAccount: {
    address: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
  faucet: {
    package_id: '0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc',
    published_at: '0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc',
  },
  deepbook: {
    package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
  },
  deepbook_endpoint_v2: {
    package_id: '0x56d90d0c055edb534b11e7548270bb458fd47c69b77bf40c14d5eb00e6e6cf64',
    published_at: '0x56d90d0c055edb534b11e7548270bb458fd47c69b77bf40c14d5eb00e6e6cf64',
  },
  aggregatorUrl: 'https://api-sui.devmagma.com/router',
  swapCountUrl: 'https://api-sui.devmagma.com/v2/sui/swap/count',
}

/**
 * Initialize the testnet SDK
 * @param fullNodeUrl. If provided, it will be used as the full node URL.
 * @param simulationAccount. If provided, it will be used as the simulation account address.
 * @returns
 */
export function initTestnetSDK(fullNodeUrl?: string, simulationAccount?: string): MagmaClmmSDK {
  if (fullNodeUrl) {
    clmmTestnet.fullRpcUrl = fullNodeUrl
  }
  if (simulationAccount) {
    clmmTestnet.simulationAccount.address = simulationAccount
  }
  return new MagmaClmmSDK(clmmTestnet)
}
