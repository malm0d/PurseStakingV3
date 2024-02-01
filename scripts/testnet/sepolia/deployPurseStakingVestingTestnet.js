const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying PurseStakingVesting on Sepolia

//npx hardhat compile --force
//npx hardhat run --network sepolia scripts/testnet/sepolia/deployPurseStakingVestingTestnet.js
//npx hardhat verify --network sepolia 0x..implementationaddress

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE_STAKING = "0x6935a78b5ff92435662FB365085e5E490cC032C5";
    const PurseStakingVesting = await hre.ethers.getContractFactory("PurseStakingVesting");
    const purseStakingVesting = await upgrades.deployProxy(
        PurseStakingVesting,
        [
            PURSE_STAKING,
        ]
    );
    await purseStakingVesting.waitForDeployment();
    console.log("PurseStakingVesting deployed to: ", await purseStakingVesting.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});