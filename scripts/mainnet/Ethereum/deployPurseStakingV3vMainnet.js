const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deploying PurseStakingV3v on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/deployPurseStakingV3vMainnet.js
//npx hardhat verify --network mainnet 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE = "0x95987b0cdC7F65d989A30B3B7132a38388c548Eb";
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