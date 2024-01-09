const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStakingV3 to PurseStakingV3v with new vesting logic, on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradeToPurseStakingV3vTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const PROXY = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3WithVesting = await hre.ethers.getContractFactory("PurseStakingV3v");
    const purseStakingV3WithVesting = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3WithVesting,
    )
    console.log("Upgraded");

    //Note: after upgrade and deploying the vesting contract, 
    //do not forget to update vesting address in PurseStakingV3.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});