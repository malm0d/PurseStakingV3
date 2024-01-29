const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade StakePurseVaultVesting on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradeStakePurseVaultVestingTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const proxy = "0x1cddE3BB0DaF9Def56F7e5e5B8BfDFd6689160A7"
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const StakePurseVaultVesting = await hre.ethers.getContractFactory("StakePurseVaultVesting");
    const stakePurseVaultVesting = await upgrades.upgradeProxy(
        proxy,
        StakePurseVaultVesting,
    )
    console.log("Upgraded");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});