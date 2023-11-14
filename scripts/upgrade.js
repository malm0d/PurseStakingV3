// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { upgrades } = require("hardhat");

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/upgrade.js
//npx hardhat verify --network bsctestnet 0x...
async function main() {
    const PROXY = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3 = await hre.ethers.getContractFactory("PurseStakingV3");
    const purseStakingV3 = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3,
    )

    console.log("Upgraded");

    // const treasuryProxy = "0xb643dF48cDe7456c19B4a8273E73564215ba9aBf";
    // const [deployer] = await hre.ethers.getSigners();
    // console.log(`Deployer: ${deployer.address}`);
    // console.log();
    // const TreasuryNew = await hre.ethers.getContractFactory("Treasury");
    // const treasuryNew = await upgrades.upgradeProxy(
    //     treasuryProxy,
    //     TreasuryNew,
    // )
    // console.log("upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});