const hre = require("hardhat");
const { upgrades } = require("hardhat");

// For importing PurseStakingV2 data from mainnet for upgrading to PurseStakingV3

//npx hardhat run --network bscmainnet scripts/mainnet/forceImportPurseStakingV2.js
async function main() {
    const PROXY = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();

    const PurseStakingV2 = await hre.ethers.getContractFactory("PurseStakingV2");
    //contract factory must be the current implementation contract version
    await upgrades.forceImport(
        PROXY,
        PurseStakingV2,
        { "kind": "uups" }
    )
    console.log("Force Import Complete");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});