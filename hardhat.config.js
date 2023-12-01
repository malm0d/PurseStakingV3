require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;

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
      url: "https://bsc-dataseed.bnbchain.org/",
      chainId: 56,
      gasPrice: 10000000000,
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
    apiKey: process.env.BSCSCANAPI
  }
};
