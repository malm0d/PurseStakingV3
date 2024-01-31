const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade StakePurseVaultTreasury on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradeStakePurseVaultTreasuryTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const proxy = "0xA95B5650c6D525a8d82E6Ec766d1c6DF7eC0c4e7"
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVaultTreasury = await hre.ethers.getContractFactory("StakePurseVaultTreasury");
    const stakePurseVaultTreasury = await upgrades.upgradeProxy(
        proxy,
        StakePurseVaultTreasury,
    )
    console.log("Upgraded");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});