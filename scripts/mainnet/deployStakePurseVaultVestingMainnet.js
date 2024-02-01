const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys StakePurseVaultVesting contract to BSC mainnet

//npx hardhat compile --force
//npx hardhat run --network bscmainnet scripts/mainnet/deployStakePurseVaultVestingMainnet.js
//npx hardhat verify --network bscmainnet 0x...(implementation address)

async function main() {
    const STAKEPURSEVAULT_ADDRESS = "0x6659B42C106222a50EE555F76BaD09b68EC056f9";
    const STAKEPURSEVAULTTREASURY_ADDRESS = "0xCC799d8A802a1A594Eff1064920092f48EF3cB2a";

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVaultVesting = await hre.ethers.getContractFactory("StakePurseVaultVesting");
    const stakePurseVaultVesting = await upgrades.deployProxy(
        StakePurseVaultVesting,
        [
            STAKEPURSEVAULT_ADDRESS, //StakePurseVault
            STAKEPURSEVAULTTREASURY_ADDRESS, //StakePurseVaultTreasury
        ],
        {
            txOverrides: { gasLimit: 2000000n },
        }
    );
    await stakePurseVaultVesting.waitForDeployment();
    console.log("StakePurseVaultVesting deployed to: ", await stakePurseVaultVesting.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});