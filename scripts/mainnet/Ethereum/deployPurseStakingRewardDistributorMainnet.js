const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deploying PurseStaking RewardDistributor on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/deployPurseStakingRewardDistributorMainnet.js
//npx hardhat verify --network mainnet 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE = "0x95987b0cdC7F65d989A30B3B7132a38388c548Eb";
    const PURSE_STAKING = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
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