// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys PurseStakingV3's Reward Distributor and Treasury contracts

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/deployTreasuryAndDistributorV3.js
//npx hardhat verify --network bsctestnet 0x...

// testnet deployer: 0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807

// Mainnet
// const PURSE_TOKEN_ADDRESS = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
// const PURSE_STAKING_PROXY_ADDRESS = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";

async function main() {
    const PURSE_TOKEN_ADDRESS = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
    const PURSE_STAKING_PROXY_ADDRESS = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const rewardDistributor = await upgrades.deployProxy(
        RewardDistributor,
        [
            PURSE_TOKEN_ADDRESS,
            PURSE_STAKING_PROXY_ADDRESS,
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82"
        ]
    );
    await rewardDistributor.waitForDeployment();
    console.log("Distributor deployed to: ", await rewardDistributor.getAddress());
    console.log();

    const Treasury = await hre.ethers.getContractFactory("Treasury");
    const treasury = await upgrades.deployProxy(
        Treasury,
        [
            PURSE_STAKING_PROXY_ADDRESS,
            await rewardDistributor.getAddress()
        ]
    );
    await treasury.waitForDeployment();
    console.log("Treasury deployed to: ", await treasury.getAddress());
    console.log();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
