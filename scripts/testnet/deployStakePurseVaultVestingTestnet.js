const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys StakePurseVaultVesting contract to BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/deployStakePurseVaultVestingTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const STAKEPURSEVAULT_ADDRESS = "0x2be6B3045A772A9C3EcC776450D09e06040F8ED7";
    const STAKEPURSEVAULTTREASURY_ADDRESS = "0xA95B5650c6D525a8d82E6Ec766d1c6DF7eC0c4e7";

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVaultVesting = await hre.ethers.getContractFactory("StakePurseVaultVesting");
    const stakePurseVaultVesting = await upgrades.deployProxy(
        StakePurseVaultVesting,
        [
            STAKEPURSEVAULT_ADDRESS, //StakePurseVault
            STAKEPURSEVAULTTREASURY_ADDRESS, //StakePurseVaultTreasury
        ]
    );
    await stakePurseVaultVesting.waitForDeployment();
    console.log("StakePurseVaultVesting deployed to: ", await stakePurseVaultVesting.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});