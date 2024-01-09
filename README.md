# PurseStaking V3

This repository contains the contracts and files for the PurseStakingV3 ecosystem.

There are also other files under the `scripts` directory used to perform some analytics, such as finding the top liquidity providers for PURSE-WFX, and calculating earned rewards for PURSE-BUSD (now deprecated), and calculating the APR for the PURSE-USDT pool.

## Contracts
- PurseStakingV3
- RewardDistributor
- Treasury
- Vesting

## Addresses
### BSC Mainnet
#### Purse Staking
- Purse: 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
- PurseStakingV3: 0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE
- RewardDistributor: 0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40
- Treasury: 0x6935a78b5ff92435662FB365085e5E490cC032C5
- PurseStakingVesting:

#### Stake Purse Vault
- StakePurseVault
- StakePurseVaultVesting:
- StakePurseVaultTreasury:

### BSC Testnet
#### Purse Staking
- Purse: 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141
- PurseStakingV3:0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508
- RewardDistributor:0xdb307306ae74EefaCf26afdca25C5A11D5b7e09e
- Treasury: 0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB
- PurseStakingVesting:0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053

#### Stake Purse Vault
- StakePurseVault:
- StakePurseVaultVesting:
- StakePurseVaultTreasury:


## Utility scripts
- purseUsdtAPRCalc: Calculates parameters to set to achieve specified APR for PURSE-USDT Pool

## Using forked networks
Run: `npx hardhat node --fork https://<Chainstack_endpoint>`.

Use `--network hardhat` in hardhat commands. The current forked network is bsc testnet.