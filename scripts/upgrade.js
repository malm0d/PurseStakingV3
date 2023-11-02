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
    const PROXY = "0x1e4Dc34f66Be83D863006086128B7259cf3AD0eD";
    const PURSE_TOKEN_ADDRESS = "0xE81165fCDD0336A0f219cF8235D6287Bd0f9f752";
    const DISTRIBUTOR_ADDRESS = "0x95e71f6C7d8D3b32bd697A88dD6C37346130e67F";
    const TREASURY_ADDRESS = "0x49e5eE0aF3Abf26f02c3107B99fc849acc40C3dF";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3 = await hre.ethers.getContractFactory("PurseStakingV3");
    const purseStakingV3 = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3,
    )

    console.log("Upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});