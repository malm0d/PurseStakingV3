const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys StakePurseVaultTreasury contract to BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/deployStakePurseVaultTreasuryTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVaultTreasury = await hre.ethers.getContractFactory("StakePurseVaultTreasury");
    const stakePurseVaultTreasury = await upgrades.deployProxy(
        StakePurseVaultTreasury
    );
    await stakePurseVaultTreasury.waitForDeployment();
    console.log("StakePurseVaultTreasury deployed to: ", await stakePurseVaultTreasury.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});