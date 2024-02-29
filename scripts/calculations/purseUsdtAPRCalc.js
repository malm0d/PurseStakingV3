const hre = require("hardhat");
const PURSE_LP_POOL_ABI = require("../../abis/PurseLPRestakePool.json");
const PURSE_USDT_ABI = require("../../abis/PurseUsdtLPToken.json");
const PURSE_ABI = require("../../abis/PurseBsc.json");
const USDT_ABI = require("../../abis/UsdtBsc.json");
const axios = require('axios');

// npx hardhat run --network bscmainnet scripts/calculations/purseUsdtAPRCalc.js

const endpoint = "https://bsc-mainnet.chainnodes.org/ca0d8638-3aff-4563-a8cb-e7e36ed32201";
const provider = new ethers.JsonRpcProvider(endpoint);

const poolAddress = "0x439ec8159740a9B9a579F286963Ac1C050aF31C8";
const purseUsdtAddress = "0xfc450e16016aF4e4197f5dB5Ca0d262fF8fD735a";
const purseAddress = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; //this is == BSC-USD

const poolContract = new hre.ethers.Contract(
    poolAddress,
    PURSE_LP_POOL_ABI,
    provider
);

const purseUsdtContract = new hre.ethers.Contract(
    purseUsdtAddress,
    PURSE_USDT_ABI,
    provider
);

const purseTokenContract = new hre.ethers.Contract(
    purseAddress,
    PURSE_ABI,
    provider
);

const usdtTokenContract = new hre.ethers.Contract(
    usdtAddress,
    USDT_ABI,
    provider
);

const queryPricesApi = async () => {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin%2Cweth%2Cbinance-usd%2Cusd-coin%2Ctether%2Cbitcoin%2Cpundi-x-purse&vs_currencies=usd";
    const response = await axios.get(url);
    const json = response.data;
    return json;
}

async function main() {
    //Total supply of PURSE-USDT LP tokens (BigInt)
    const purseUsdtTotalSupply = await purseUsdtContract.totalSupply();
    console.log("TotalSupply of PurseUsdt LP tokens: ", purseUsdtTotalSupply.toString());
    console.log()

    //Total staked PURSE-USDT in Restaking Pool (BigInt)
    const purseUsdtTotalStaked = await purseUsdtContract.balanceOf(poolAddress);
    console.log("TotalStaked in pool (LP tokens in pool contract: ", purseUsdtTotalStaked.toString());
    console.log()

    //Balance of PURSE token in Pair contract (BigInt)
    const purseBalanceInPair = await purseTokenContract.balanceOf(purseUsdtAddress);
    console.log("Purse balance in Pair contract: ", purseBalanceInPair.toString());
    console.log();

    //Balance of USDT token in Pair contract (BigInt)
    const usdtBalanceInPair = await usdtTokenContract.balanceOf(purseUsdtAddress);
    console.log("USDT balance in Pair contract: ", usdtBalanceInPair.toString());
    console.log();

    //Purse per block and bonus multiplier (BigInt)
    const poolInfo = await poolContract.poolInfo(purseUsdtAddress);
    const pursePerBlock = poolInfo[1];
    const bonusMultiplier = poolInfo[2];
    console.log("Current Purse per block: ", pursePerBlock.toString());
    console.log('Current bonus multiplier: ', bonusMultiplier.toString());
    console.log();

    //Latest price of PURSE and USDT tokens
    const jsonPrices = await queryPricesApi();
    console.log(jsonPrices);
    let pursePrice = jsonPrices["pundi-x-purse"]["usd"];
    let usdtPrice = jsonPrices["tether"]["usd"];
    console.log("Purse price: ", pursePrice);
    console.log("USDT price: ", usdtPrice);
    console.log();

    //Get LP token value
    const lpTokenValNumerator =
        (Number(purseBalanceInPair) / (10 ** 18) * pursePrice)
        + (Number(usdtBalanceInPair) / (10 ** 18) * usdtPrice)
    console.log("LP token value numerator: ", lpTokenValNumerator);
    const lpTokenValue = lpTokenValNumerator / (Number(purseUsdtTotalSupply) / 10 ** 18);
    console.log("LP token value: ", lpTokenValue);
    console.log();

    //Get TVL
    const tvl = (Number(purseUsdtTotalStaked) / 10 ** 18) * lpTokenValue;
    console.log("Total Value Locked: ", tvl.toString());
    console.log();

    //Get APR
    //Ensure that formula here achieves almost the same result as the APR from the mongo endpoint for PURSE-USDT
    //https://ap-southeast-1.aws.data.mongodb-api.com/app/data-rjjms/endpoint/PundiX
    const apr = ((28000 * 365 * (Number(pursePerBlock * bonusMultiplier) / 10 ** 18) * pursePrice)) / tvl * 100;
    console.log("Current APR: " + apr);
    console.log();

    //Adjust target APR here, this will calculate how much pursePerBlock to set to achieve the targetted APR.
    const targetAPR = 30;
    const targetPursePerBlock = (targetAPR * tvl / 100) / (28000 * 365 * (Number(bonusMultiplier) / 10 ** 18) * pursePrice)
    console.log("Target APR: ", targetAPR);
    console.log("Target Purse per block (WEI): ", targetPursePerBlock);
    console.log("Target Purse per block (ETHER): ", targetPursePerBlock / 10 ** 18);
    console.log();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});