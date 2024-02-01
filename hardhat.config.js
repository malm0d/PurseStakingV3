require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-web3");
require("dotenv").config();
require("@nomicfoundation/hardhat-network-helpers");


const MNEMONIC = process.env.MNEMONIC;
const testnetArchiveNodeFork = process.env.BSC_TESTNET_ARCHIVE_NODE;//Chainstack node (BSC)
const mainnetArchiveNodeFork = process.env.BSC_MAINNENT_ARCHIVE_NODE;//Chainstack node (BSC)
const SEPOLIA_ENDPOINT = process.env.SEPOLIA_ENDPOINT

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: testnetArchiveNodeFork,
      },
      accounts: {
        mnemonic: MNEMONIC
      }
    },
    sepolia: {
      url: SEPOLIA_ENDPOINT,
      chainId: 11155111,
      accounts: {
        mnemonic: MNEMONIC
      }
    },
    bsctestnet: {
      url: "https://bsc-testnet.publicnode.com	",
      chainId: 97,
      gas: 12400000,
      gasPrice: 20000000000,
      accounts: {
        mnemonic: MNEMONIC
      },
      networkCheckTimeout: 999999,
      timeoutBlocks: 200,
    },
    bscmainnet: {
      url: "https://bsc-mainnet.chainnodes.org/062698ce-0d9b-4eae-b9b8-e0525dafaa86",
      chainId: 56,
      gasPrice: 3000000000,
      accounts: {
        mnemonic: MNEMONIC
      },
    },
    fxMainnet: {
      url: "https://fx-json-web3.functionx.io:8545",
      networkCheckTimeout: 999999,
      timeoutBlocks: 200,
      accounts: {
        mnemonic: MNEMONIC
      }
    },
    fxTestnet: {
      url: "https://testnet-fx-json-web3.functionx.io:8545",
      networkCheckTimeout: 999999,
      timeoutBlocks: 200,
      accounts: {
        mnemonic: MNEMONIC
      }
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCANAPI,
      bsc: process.env.BSCSCANAPI
    }
  },
  mocha: {
    timeout: 300000
  }
};
