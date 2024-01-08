const hre = require("hardhat");
const MASTERCHEF_FX_ABI = require("../../abis/MasterChefFxMainnet.json");
const MULTIPLIER_ABI = require("../../abis/RewarderViaMultiplierV2.json");
const axios = require("axios");

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

const queryPricesApi = async () => {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin%2Cweth%2Cbinance-usd%2Cusd-coin%2Ctether%2Cbitcoin%2Cpundi-x-purse&vs_currencies=usd";
    const response = await axios.get(url);
    const json = response.data;
    return json;
}

// npx hardhat run --network fxMainnet scripts/calculations/calcPurseRewardsMultiplier.js
async function main() {
    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const blocksInOneWeek = 102508;
    const masterChefRewardsPerBlock = await masterChefFxContract.rewardPerBlock();

    const wFXRewardsPerWeek = (Number(masterChefRewardsPerBlock) / 10 ** 18) * blocksInOneWeek;

    const purseWfxPoolInfo = await masterChefFxContract.poolInfo(2);

    const purseWfxPoolAllocPoint = purseWfxPoolInfo[1];

    const totalAllocPoint = await masterChefFxContract.totalAllocPoint();

    const purseWfxPoolAllocPointRatio = Number(purseWfxPoolAllocPoint) / Number(totalAllocPoint);

    const wFXRewardsWithAllocPointRatio = wFXRewardsPerWeek * purseWfxPoolAllocPointRatio;
    console.log("MasterChef wFX rewards per week with alloc point ratio: ", wFXRewardsWithAllocPointRatio);

    const multiplierValue = Number(await multiplierContract.rewardMultipliers(0)) / 10 ** 18;
    console.log("Current multiplier value (ether): ", multiplierValue);
    console.log("Current multiplier value (wei): ", BigInt(multiplierValue * 10 ** 18));
    console.log();

    // const weeklyPurseRewards = wFXRewardsWithAllocPointRatio * multiplierValue;
    // console.log("Weekly PURSE rewards: ", weeklyPurseRewards);
    // console.log()

    // const targetPurseRewards = 1000;
    // const purseRewardsMultiplier = targetPurseRewards / wFXRewardsWithAllocPointRatio;
    // console.log("To get 1000 PURSE rewards per week, the multiplier should be:")
    // console.log("Purse rewards multiplier: ", purseRewardsMultiplier);
    // console.log();

    //--------------------------------------------------------------------------------

    let data = await axios.get("https://ap-southeast-1.aws.data.mongodb-api.com/app/data-rjjms/endpoint/tvl_prod");
    data = data.data;
    const purseWfxTvl = Number(data["AllData"]["tvl"]["2"]);
    console.log("Purse-WFX TVL (USD): ", purseWfxTvl);
    const currentPurseWfxAPR = Number(data["AllData"]["apr"]["2"]);
    console.log("Current PURSE-WFX APR: ", currentPurseWfxAPR);
    const targetPurseWfxApr = 120;
    console.log("Target PURSE-WFX APR: ", targetPurseWfxApr);
    console.log();

    const purseWfxAprToIncrease = targetPurseWfxApr - currentPurseWfxAPR;
    console.log("Target increase in PURSE-WFX APR: ", purseWfxAprToIncrease);

    const jsonPrices = await queryPricesApi();
    const pursePrice = jsonPrices["pundi-x-purse"]["usd"];
    console.log("Purse price (USD): ", pursePrice);
    console.log();

    const targetPurseRewardsValuePerYear = (purseWfxAprToIncrease * purseWfxTvl) / 100;
    console.log("Target PURSE rewards per year (USD): ", targetPurseRewardsValuePerYear);

    const targetPurseRewardsValuePerWeek = targetPurseRewardsValuePerYear / 52;
    console.log("Target PURSE rewards per week (USD): ", targetPurseRewardsValuePerWeek);

    const targetPurseRewardsPerWeek = targetPurseRewardsValuePerWeek / pursePrice;
    console.log("Target PURSE rewards per week (Tokens): ", targetPurseRewardsPerWeek);
    console.log();

    const targetRewardMultiplierEther = targetPurseRewardsPerWeek / wFXRewardsWithAllocPointRatio;
    const targetRewardMultiplierWei = BigInt(targetRewardMultiplierEther * 10 ** 18);
    console.log("Target reward multiplier (ether): ", targetRewardMultiplierEther);
    console.log("Target reward multiplier (wei): ", targetRewardMultiplierWei);


    // const tx = await multiplierContract.connect(owner).transferOwnership(

    // );
    // await tx.wait();
    // console.log("Complete");

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