const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStaking RewardDistributor on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/upgradePurseStakingRewardDistributorMainnet.js
//npx hardhat verify --network mainnet 0x...
async function main() {
    const PROXY = "0x6e752c65dfE3A96d0E2d5B962a496ae3184a1C27";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const rewardDistributor = await upgrades.upgradeProxy(
        PROXY,
        RewardDistributor,
    )

    console.log("Upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});