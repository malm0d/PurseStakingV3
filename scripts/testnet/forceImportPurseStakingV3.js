const hre = require("hardhat");
const { upgrades } = require("hardhat");

// For importing PurseStakingV3 data for upgrade

//npx hardhat run --network bsctestnet scripts/testnet/forceImportPurseStakingV3.js
async function main() {
    const PROXY = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV3 = await hre.ethers.getContractFactory("PurseStakingV3");
    //contract factory must be the current implementation contract version
    await upgrades.forceImport(
        PROXY,
        PurseStakingV3,
        { "kind": "uups" }
    )
    console.log("Force Import Complete");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});