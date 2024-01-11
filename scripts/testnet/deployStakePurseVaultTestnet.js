const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys StakePurseVault contract to BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/deployStakePurseVaultTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVault = await hre.ethers.getContractFactory("StakePurseVault");
    const stakePurseVault = await upgrades.deployProxy(
        StakePurseVault,
        [
            PURSE_ADDRESS, //assetToken
            deployer.address, //owner
            deployer.address, //governor
        ]
    );
    await stakePurseVault.waitForDeployment();
    console.log("StakePurseVault deployed to: ", await stakePurseVault.getAddress());
    console.log();

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});