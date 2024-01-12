const data = require("../../eventLogs.json");
const fs = require('fs');

//npx hardhat run scripts/calculations/dataPancakeSwapPool_Parse.js

function parseAndAggregate(
    depositEventsJson,
    withdrawEventsJson,
    claimRewardEventsJson
) {
    const userTotals = {};

    const tallyAmounts = (jsonData, event) => {
        jsonData.forEach(({ userAddress, amount }) => {
            if (!userTotals[userAddress]) {
                userTotals[userAddress] = {
                    Deposit: BigInt(0),
                    Withdraw: BigInt(0),
                    ClaimReward: BigInt(0),
                };
            }
            //Dynamic property access
            userTotals[userAddress][event] += BigInt(amount);
        });
    };

    //Process each event type
    tallyAmounts(depositEventsJson, "Deposit");
    tallyAmounts(withdrawEventsJson, "Withdraw");
    tallyAmounts(claimRewardEventsJson, "ClaimReward");

    return userTotals;
}

function convertToEther(aggregatedData) {
    const convertedData = {};

    for (
        const [userAddress, { Deposit, Withdraw, ClaimReward }]
        of Object.entries(aggregatedData)
    ) {
        convertedData[userAddress] = {
            Deposit: (Deposit / BigInt(1e18)).toString(),
            Withdraw: (Withdraw / BigInt(1e18)).toString(),
            ClaimReward: (ClaimReward / BigInt(1e18)).toString(),
        };
    }
    return convertedData;
}

function objectToCsv(data) {
    const header = "User,Deposits (Ether),Withdrawn (Ether),Claimed Purse Rewards (Ether)\n";

    const rows = Object.entries(data).map(([userAddress, { Deposit, Withdraw, ClaimReward }]) =>
        `${userAddress},${Deposit},${Withdraw},${ClaimReward}`
    ).join('\n');

    return header + rows;
}


async function main() {
    const depositEventsJson = require("../../pancakeLpRestakePoolDepositEvents.json");
    const withdrawEventsJson = require("../../pancakeLpRestakePoolWithdrawEvents.json");
    const claimRewardEventsJson = require("../../pancakeLpRestakePoolClaimedRewardEvents.json");

    const aggregatedData = parseAndAggregate(
        depositEventsJson,
        withdrawEventsJson,
        claimRewardEventsJson
    );

    const convertedData = convertToEther(aggregatedData);

    const csvData = objectToCsv(convertedData);

    fs.writeFileSync("./pancakeLpRestakeAllAggregatedData.csv", csvData, 'utf-8');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});