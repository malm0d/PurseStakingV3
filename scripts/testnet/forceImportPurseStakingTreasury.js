const hre = require("hardhat");
const { upgrades } = require("hardhat");

// For importing PurseStaking Treasury data for upgrade

//npx hardhat run --network bsctestnet scripts/testnet/forceImportPurseStakingTreasury.js
async function main() {
    const PROXY = "0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const Treasury = await hre.ethers.getContractFactory("Treasury");
    //contract factory must be the current implementation contract version
    await upgrades.forceImport(
        PROXY,
        Treasury,
        { "kind": "uups" }
    )
    console.log("Force Import Complete");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});