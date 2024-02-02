const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying PurseStakingVesting on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/deployPurseStakingVestingMainnet.js
//npx hardhat verify --network mainnet 0x..implementationaddress

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE_STAKING = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
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