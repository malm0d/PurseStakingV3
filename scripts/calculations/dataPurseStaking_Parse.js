const data = require("../../eventLogs.json");
const fs = require('fs');

//npx hardhat run scripts/calculations/dataPurseStaking_Parse.js

function parseAndAggregate(
    depositEventsJson,
    withdrawLockedStakeEventsJson,
    withdrawUnlockedStakeEventsJson,
    claimedEventsJson
) {
    const userTotals = {};

    const tallyAmounts = (jsonData, event) => {
        jsonData.forEach(({ userAddress, amount }) => {
            if (!userTotals[userAddress]) {
                userTotals[userAddress] = {
                    Deposit: BigInt(0),
                    WithdrawLockedStake: BigInt(0),
                    WithdrawUnlockedStake: BigInt(0),
                    Claimed: BigInt(0),
                };
            }
            //Dynamic property access
            userTotals[userAddress][event] += BigInt(amount);
        });
    };

    //Process each event type
    tallyAmounts(depositEventsJson, "Deposit");
    tallyAmounts(withdrawLockedStakeEventsJson, "WithdrawLockedStake");
    tallyAmounts(withdrawUnlockedStakeEventsJson, "WithdrawUnlockedStake");
    tallyAmounts(claimedEventsJson, "Claimed");

    return userTotals;
}

function convertToEther(aggregatedData) {
    const convertedData = {};

    for (
        const [userAddress, { Deposit, WithdrawLockedStake, WithdrawUnlockedStake, Claimed }]
        of Object.entries(aggregatedData)
    ) {
        convertedData[userAddress] = {
            Deposit: (Deposit / BigInt(1e18)).toString(),
            WithdrawLockedStake: (WithdrawLockedStake / BigInt(1e18)).toString(),
            WithdrawUnlockedStake: (WithdrawUnlockedStake / BigInt(1e18)).toString(),
            TotalWithdrawn: ((WithdrawLockedStake + WithdrawUnlockedStake) / BigInt(1e18)).toString(),
            Claimed: (Claimed / BigInt(1e18)).toString(),
        };
    }
    return convertedData;
}

function objectToCsv(data) {
    const header = "User,Deposits (Ether),WithdrawLockedStake (Ether),WithdrawUnlockedStake (Ether),Total Withdrawn (Ether),Claimed Purse Rewards(Ether)\n";

    const rows = Object.entries(data).map(([userAddress, { Deposit, WithdrawLockedStake, WithdrawUnlockedStake, TotalWithdrawn, Claimed }]) =>
        `${userAddress},${Deposit},${WithdrawLockedStake},${WithdrawUnlockedStake},${TotalWithdrawn},${Claimed}`
    ).join('\n');

    return header + rows;
}


async function main() {
    const depositEventsJson = require("../../purseStakingAllDepositEvents.json");
    const withdrawLockedStakeEventsJson = require("../../purseStakingAllWithdrawLockedStakeEvents.json");
    const withdrawUnlockedStakeEventsJson = require("../../purseStakingAllWithdrawUnlockedStakeEvents.json");
    const claimedEventsJson = require("../../purseStakingAllClaimedEvents.json");

    const aggregatedData = parseAndAggregate(
        depositEventsJson,
        withdrawLockedStakeEventsJson,
        withdrawUnlockedStakeEventsJson,
        claimedEventsJson
    );

    const convertedData = convertToEther(aggregatedData);

    const csvData = objectToCsv(convertedData);

    fs.writeFileSync("./purseStakingAllAggregatedData.csv", csvData, 'utf-8');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});