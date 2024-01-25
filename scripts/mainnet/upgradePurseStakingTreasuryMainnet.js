const hre = require("hardhat");
const { upgrades } = require("hardhat");

//Upgrade PurseStaking Treasury contract on BSC mainnet

//npx hardhat compile --force
//npx hardhat run --network bscmainnet scripts/mainnet/upgradePurseStakingTreasuryMainnet.js
//npx hardhat run --network hardhat scripts/mainnet/upgradePurseStakingTreasuryMainnet.js (for local)
//npx hardhat verify --network bscmainnet 0x...(implementation address)

async function main() {
    const proxy = "0x6935a78b5ff92435662FB365085e5E490cC032C5";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const Treasury = await hre.ethers.getContractFactory("TreasuryV2");
    const treasury = await upgrades.upgradeProxy(
        proxy,
        Treasury,
        {
            txOverrides: { gasLimit: 2000000n },
        }
    )
    console.log("Upgraded");
    console.log("New implementation address: ", await treasury.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});