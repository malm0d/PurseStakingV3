const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys StakePurseVault contract to BSC mainnet

//npx hardhat compile --force
//npx hardhat run --network bscmainnet scripts/mainnet/deployStakePurseVaultMainnet.js
//npx hardhat verify --network bscmainnet 0x...(implementation address)

async function main() {
    const PURSE_ADDRESS = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";

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
        ],
        {
            txOverrides: { gasLimit: 5000000n },
        }
    );
    await stakePurseVault.waitForDeployment();
    console.log("StakePurseVault deployed to: ", await stakePurseVault.getAddress());
    console.log();

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});