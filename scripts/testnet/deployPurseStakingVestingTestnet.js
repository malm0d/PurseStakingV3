const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys PurseStakingVesting contract to BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/deployPurseStakingVestingTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const PURSE_STAKING_ADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingVesting = await hre.ethers.getContractFactory("PurseStakingVesting");
    const purseStakingVesting = await upgrades.deployProxy(
        PurseStakingVesting,
        [
            PURSE_STAKING_ADDRESS,
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