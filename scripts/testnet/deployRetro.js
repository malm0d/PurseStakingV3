const hre = require("hardhat");
const { upgrades } = require("hardhat");

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/testnet/deployRetro.js
//npx hardhat verify --network bsctestnet 0x... 0xrootHash
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const Retro = await hre.ethers.getContractFactory("RetroactiveRewards");
    const retro = await Retro.deploy(
        "0x21e355e07f9efc7591d406770fcfa833afcd6b808364ef5c730b4279e279a33f"
    )
    await retro.waitForDeployment();
    console.log("Retro deployed to: ", await retro.getAddress());

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});