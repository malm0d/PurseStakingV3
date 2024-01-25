const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Deploys PurseStakingVesting contract to BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bscmainnet scripts/mainnet/deployPurseStakingVestingMainnet.js
//npx hardhat run --network hardhat scripts/mainnet/deployPurseStakingVestingMainnet.js (for local)
//npx hardhat verify --network bscmainnet 0x...(implementation address)

async function main() {
    const PURSE_STAKING_ADDRESS = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";

    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingVesting = await hre.ethers.getContractFactory("PurseStakingVesting");
    const purseStakingVesting = await upgrades.deployProxy(
        PurseStakingVesting,
        [
            PURSE_STAKING_ADDRESS,
        ],
        {
            txOverrides: { gasLimit: 2000000n },
        }
    );
    await purseStakingVesting.waitForDeployment();
    console.log("PurseStakingVesting deployed to: ", await purseStakingVesting.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});