const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStakingV3v on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/upgradePurseStakingV3vMainnet.js
//npx hardhat verify --network mainnet 0x...
async function main() {
    const PROXY = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3v = await hre.ethers.getContractFactory("PurseStakingV3v");
    const purseStakingV3v = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3v,
    )

    console.log("Upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});