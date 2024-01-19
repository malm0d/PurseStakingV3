const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStaking Treasury contract on BSC testnet

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/upgradePurseStakingTreasuryTestnet.js
//npx hardhat verify --network bsctestnet 0x...(implementation address)

async function main() {
    const proxy = "0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const Treasury = await hre.ethers.getContractFactory("TreasuryV2");
    const treasury = await upgrades.upgradeProxy(
        proxy,
        Treasury,
    )
    console.log("Upgraded");
    console.log("New implementation address: ", await treasury.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});