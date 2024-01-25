const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStakingV3 to PurseStakingV3v with new vesting logic, on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradePurseStakingVestingTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const PROXY = "0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingVesting = await hre.ethers.getContractFactory("PurseStakingVesting");
    const purseStakingVesting = await upgrades.upgradeProxy(
        PROXY,
        PurseStakingVesting,
    )
    console.log("Upgraded");

    //Note: after upgrade and deploying the vesting contract, 
    //do not forget to update vesting address in PurseStakingV3.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});