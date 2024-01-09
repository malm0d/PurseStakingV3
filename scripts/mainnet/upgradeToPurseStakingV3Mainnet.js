const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStakingV2 to PurseStakingV3 on BSC mainnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/mainnet/upgradeToPurseStakingV3Mainnet.js
//npx hardhat verify --network bscmainnet 0x...
async function main() {
    const PROXY = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3 = await hre.ethers.getContractFactory("PurseStakingV3");
    const purseStakingV3 = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3,
    )

    console.log("Upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});