const hre = require("hardhat");
const { upgrades } = require("hardhat");

//fxmainnet
//./node_modules/.bin/poa-solidity-flattener ./contracts/RewarderViaMultiplierV2.sol
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log();
    const MASTERCHEF_ADDRESS_MAINNET = "0x4bd522b2E25f6b1A874C78518EF25f5914C522dC";
    const PURSE_ADDRESS_MAINNET = "0x5FD55A1B9FC24967C4dB09C513C3BA0DFa7FF687";

    const rewardMultiplierValue = BigInt("23148148148000");

    const RewardMultiplierV2 = await hre.ethers.getContractFactory("RewarderViaMultiplierV2");
    const rewardMultiplierV2 = await upgrades.deployProxy(
        RewardMultiplierV2,
        [
            [PURSE_ADDRESS_MAINNET],
            [rewardMultiplierValue],
            BigInt("18"),
            MASTERCHEF_ADDRESS_MAINNET
        ]
    );
    await rewardMultiplierV2.waitForDeployment();
    console.log("RewarderViaMultiplierV2 deployed to: ", await rewardMultiplierV2.getAddress());
    console.log();
    0x4d7f3396ab3e8d680f7bbd332d1fe452e2a7da6f
    0x4d7F3396ab3E8d680F7bbd332D1FE452E2a7dA6f
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});