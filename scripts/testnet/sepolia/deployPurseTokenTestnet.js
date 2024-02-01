const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying Purse token on Sepolia

//npx hardhat compile --force
//npx hardhat run --network sepolia scripts/testnet/sepolia/deployPurseTokenTestnet.js
//npx hardhat verify --network sepolia 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const Purse = await hre.ethers.getContractFactory("PurseTokenUpgradable");
    const purse = await upgrades.deployProxy(
        Purse,
        [
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            "0xf7756F7611071B1B56a4C3616c45CB42F9f48D82",
            0,
            0,
            0
        ]
    );
    await purse.waitForDeployment();
    console.log("Purse deployed to: ", await purse.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});