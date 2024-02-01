# PurseStaking V3

This repository contains the contracts and files for the PurseStakingV3 and StakePurseVault ecosystem.

There are also other files under the `scripts` directory used to perform some analytics, such as finding the top liquidity providers for PURSE-WFX, and calculating earned rewards for PURSE-BUSD (now deprecated), and calculating the APR for the PURSE-USDT pool.

## Contract Addresses
## BSC Mainnet
### Purse Staking
- Purse: 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
- PurseStakingV3v: 0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE
- RewardDistributor: 0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40
- TreasuryV2: 0x6935a78b5ff92435662FB365085e5E490cC032C5
- PurseStakingVesting: 0x4131CF7A6B59510BF969eECaFc2730cE3371486d

### Stake Purse Vault
- StakePurseVault: 0x6659B42C106222a50EE555F76BaD09b68EC056f9
- StakePurseVaultVesting: 0x3f7f7b667a26330E33B38A144a18315542fBc3F0
- StakePurseVaultTreasury (Fee Treasury): 0xCC799d8A802a1A594Eff1064920092f48EF3cB2a
- Vault Ecosystem Reward Distributor: 0x0dc9c1934425AF53ccf8B4e7A87Ee5E97eF865bf

--------------------------------------------------------------------------------------------

## BSC Testnet
### Purse Staking
- Purse: 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141
- PurseStakingV3v: 0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508
- RewardDistributor: 0xdb307306ae74EefaCf26afdca25C5A11D5b7e09e
- TreasuryV2: 0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB
- PurseStakingVesting: 0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053

### Stake Purse Vault
- StakePurseVault: 0x1503B2Dd085e5fA4a88f3968EE4f063aa35348B9
- StakePurseVaultVesting: 0x1cddE3BB0DaF9Def56F7e5e5B8BfDFd6689160A7
- StakePurseVaultTreasury (Fee Treasury): 0xb45D05ed99168c7BC21C5120642cC235b5331da8
- Vault Ecosystem Reward Distributor: 0xD9fab2a4C31030a76298db1F3Cc65afbFE4006B0

--------------------------------------------------------------------------------------------

## Sepolia
- Purse: 0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40
- PurseStakingV3v: 0x6935a78b5ff92435662FB365085e5E490cC032C5
- RewardDistributor: 0x7B49F36d18c309fc4B26b529BA4433B3116049Ce
- TreasuryV2: 0x3a8d6d7cc712bF99140440Db813E8EEd5D7DEC1F
- PurseStakingVesting: 0x6e752c65dfE3A96d0E2d5B962a496ae3184a1C27


## Utility scripts
- purseUsdtAPRCalc: Calculates parameters to set to achieve specified APR for PURSE-USDT Pool

## Using forked networks
Run: `npx hardhat node --fork https://<Chainstack_endpoint>`.

Use `--network hardhat` in hardhat commands. The current forked network is bsc testnet.