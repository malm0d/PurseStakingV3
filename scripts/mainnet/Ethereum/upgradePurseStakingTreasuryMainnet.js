const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStaking Treasury on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/upgradePurseStakingTreasuryMainnet.js
//npx hardhat verify --network mainnet 0x...
async function main() {
    const PROXY = "0x7B49F36d18c309fc4B26b529BA4433B3116049Ce";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const Treasury = await hre.ethers.getContractFactory("TreasuryV2");
    const treasury = await upgrades.upgradeProxy(
        PROXY,
        Treasury,
    )

    console.log("Upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});