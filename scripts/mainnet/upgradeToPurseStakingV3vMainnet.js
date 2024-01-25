const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStakingV3 to PurseStakingV3v with new vesting logic, on BSC mainnet

//npx hardhat compile --force
//npx hardhat run --network bscmainnet scripts/mainnet/upgradeToPurseStakingV3vMainnet.js
//npx hardhat run --network hardhat scripts/mainnet/upgradeToPurseStakingV3vMainnet.js (for local)
//npx hardhat verify --network bscmainnet 0x...(implementation address)

async function main() {
    const PROXY = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3WithVesting = await hre.ethers.getContractFactory("PurseStakingV3v");
    const purseStakingV3WithVesting = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingV3WithVesting,
        {
            txOverrides: { gasLimit: 3000000n },
        }
    )
    console.log("Upgraded");

    //Note: after upgrade and deploying the vesting contract, 
    //do not forget to update vesting address in PurseStakingV3.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});