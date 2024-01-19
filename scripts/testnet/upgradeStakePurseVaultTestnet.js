const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade StakePurseVault on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradeStakePurseVaultTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const proxy = "0x2be6B3045A772A9C3EcC776450D09e06040F8ED7"
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVault = await hre.ethers.getContractFactory("StakePurseVault");
    const stakePurseVault = await upgrades.upgradeProxy(
        proxy,
        StakePurseVault,
    )
    console.log("Upgraded");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});