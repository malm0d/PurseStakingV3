// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { upgrades } = require("hardhat");

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/deployV3.js
//npx hardhat verify --network bsctestnet 0x...
async function main() {
    const PURSE_TOKEN_ADDRESS = "0xE81165fCDD0336A0f219cF8235D6287Bd0f9f752";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const rewardDistributor = await upgrades.deployProxy(
        RewardDistributor,
        [
            PURSE_TOKEN_ADDRESS,
            "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
            "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
            "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
            "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807"
        ]
    );
    await rewardDistributor.waitForDeployment();
    console.log("Distributor deployed to: ", await rewardDistributor.getAddress());
    console.log();

    const Treasury = await hre.ethers.getContractFactory("Treasury");
    const treasury = await upgrades.deployProxy(
        Treasury,
        [
            "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
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
