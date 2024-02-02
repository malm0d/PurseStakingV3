const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deployying PurseStaking Treasury on Ethereum Mainnet

//npx hardhat compile --force
//npx hardhat run --network mainnet scripts/mainnet/Ethereum/deployPurseStakingTreasuryMainnet.js
//npx hardhat verify --network mainnet 0x...

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const PURSE_STAKING = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
    const REWARD_DISTRIBUTOR = "0x6e752c65dfE3A96d0E2d5B962a496ae3184a1C27";
    const Treasury = await hre.ethers.getContractFactory("TreasuryV2");
    const treasury = await upgrades.deployProxy(
        Treasury,
        [
            PURSE_STAKING,
            REWARD_DISTRIBUTOR
        ]
    );
    await treasury.waitForDeployment();
    console.log("Treasury deployed to: ", await treasury.getAddress());
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});