const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying PurseStaking Treasury on Sepolia

//npx hardhat compile --force
//npx hardhat run --network sepolia scripts/testnet/sepolia/deployPurseStakingTreasuryTestnet.js
//npx hardhat verify --network sepolia 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE_STAKING = "0x6935a78b5ff92435662FB365085e5E490cC032C5";
    const REWARD_DISTRIBUTOR = "0x7B49F36d18c309fc4B26b529BA4433B3116049Ce";
    const Treasury = await hre.ethers.getContractFactory("TreasuryV2");
    const treasury = await upgrades.deployProxy(
        Treasury,
        [
            PURSE_STAKING,
            REWARD_DISTRIBUTOR
        ]
    );
    await treasury.waitForDeployment();
    console.log("Treasury deployed to: ", await treasury.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});