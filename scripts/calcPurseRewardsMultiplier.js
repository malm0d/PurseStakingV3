const hre = require("hardhat");
const MASTERCHEF_FX_ABI = require("../abis/MasterChefFxMainnet.json");
const MULTIPLIER_ABI = require("../abis/RewarderViaMultiplierV2.json");

const endpoint = "https://fx-json-web3.functionx.io:8545"
const provider = new ethers.JsonRpcProvider(endpoint);

const MASTERCHEF_FX_ADDRESS = "0x4bd522b2E25f6b1A874C78518EF25f5914C522dC";
const MULTIPLIER_ADDRESS = "0xE839F98AE3a9d484af77b705DdE63039ad449633";

const masterChefFxContract = new ethers.Contract(
    MASTERCHEF_FX_ADDRESS,
    MASTERCHEF_FX_ABI,
    provider
);

const multiplierContract = new ethers.Contract(
    MULTIPLIER_ADDRESS,
    MULTIPLIER_ABI,
    provider
);
// npx hardhat run --network fxMainnet scripts/calcPurseRewardsMultiplier.js
async function main() {
    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const blocksInOneWeek = 102508;
    const masterChefRewardsPerBlock = await masterChefFxContract.rewardPerBlock();
    console.log(masterChefRewardsPerBlock)
    const wFXRewardsPerWeek = (Number(masterChefRewardsPerBlock) / 10 ** 18) * blocksInOneWeek;
    console.log(wFXRewardsPerWeek)
    const purseWfxPoolInfo = await masterChefFxContract.poolInfo(2);
    console.log(purseWfxPoolInfo)
    const purseWfxPoolAllocPoint = purseWfxPoolInfo[1];
    console.log(purseWfxPoolAllocPoint)
    const totalAllocPoint = await masterChefFxContract.totalAllocPoint();
    console.log(totalAllocPoint);
    const purseWfxPoolAllocPointRatio = Number(purseWfxPoolAllocPoint) / Number(totalAllocPoint);
    console.log(purseWfxPoolAllocPointRatio)
    const wFXRewardsWithAllocPointRatio = wFXRewardsPerWeek * purseWfxPoolAllocPointRatio;
    console.log(wFXRewardsWithAllocPointRatio)
    const multiplierValue = Number(await multiplierContract.rewardMultipliers(0)) / 10 ** 18;
    console.log(multiplierValue)
    const weeklyPurseRewards = wFXRewardsWithAllocPointRatio * multiplierValue;
    console.log("Weekly PURSE rewards: ", weeklyPurseRewards);

    const targetPurseRewards = 1000;
    const purseRewardsMultiplier = targetPurseRewards / wFXRewardsWithAllocPointRatio;
    console.log("To get 1000 PURSE rewards per week, the multiplier should be:")
    console.log("Purse rewards multiplier: ", purseRewardsMultiplier);

    const tx = await multiplierContract.connect(owner).transferOwnership(

    );
    await tx.wait();
    console.log("Complete");

    // const tx = await multiplierContract.connect(owner).updateMultiplier(
    //     0,
    //     BigInt("223797991015162460")
    // );
    // await tx.wait();
    // console.log("Complete");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});