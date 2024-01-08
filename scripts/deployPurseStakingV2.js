// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { upgrades } = require("hardhat");

//For deploying PurseStakingV2 for testing purposes

//npx hardhat compile --force
//npx hardhat run --network bsctestnet scripts/deployPurseStakingV2.js
//npx hardhat verify --network bsctestnet 0x...
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log();
  const Purse = await hre.ethers.getContractFactory("PurseTokenUpgradable");
  const purse = await upgrades.deployProxy(
    Purse,
    [
      "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
      "0x2027E055201E26b1bFE33Eb923b3fdb7E6f30807",
      0,
      0,
      0
    ]
  );
  await purse.waitForDeployment();
  console.log("Purse deployed to: ", await purse.getAddress());
  console.log();

  const PurseStaking = await hre.ethers.getContractFactory("PurseStakingV2");
  const purseStaking = await upgrades.deployProxy(
    PurseStaking,
    [
      await purse.getAddress()
    ]
  );
  await purseStaking.waitForDeployment();
  console.log("PurseStakingV2 deployed to: ", await purseStaking.getAddress());
  console.log();

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
