const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying PurseStakingV3v on Sepolia

//npx hardhat compile --force
//npx hardhat run --network sepolia scripts/testnet/sepolia/deployPurseStakingV3vTestnet.js
//npx hardhat verify --network sepolia 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
    const PurseStaking = await hre.ethers.getContractFactory("PurseStakingV3v");
    const purseStaking = await upgrades.deployProxy(
        PurseStaking,
        [
            PURSE
        ]
    );
    await purseStaking.waitForDeployment();
    console.log("PurseStakingV3v deployed to: ", await purseStaking.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});