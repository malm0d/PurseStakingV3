const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deploying PurseStaking RewardDistributor on Sepolia

//npx hardhat compile --force
//npx hardhat run --network sepolia scripts/testnet/sepolia/deployPurseStakingRewardDistributorTestnet.js
//npx hardhat verify --network sepolia 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
    const PURSE_STAKING = "0x6935a78b5ff92435662FB365085e5E490cC032C5";
    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const rewardDistributor = await upgrades.deployProxy(
        RewardDistributor,
        [
            PURSE,
            PURSE_STAKING,
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82"
        ]
    );
    await rewardDistributor.waitForDeployment();
    console.log("Distributor deployed to: ", await rewardDistributor.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});