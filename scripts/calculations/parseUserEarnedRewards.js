const fs = require('fs');
const earnedRewardsRawData = require("../purseBusdUserEarnedRewards.json");

//npx hardhat run --network bscmainnet scripts/calculations/parseUserEarnedRewards.js

// [
//     {
//       "user": "0x5f9AD501dc86A5C05818D1e6363C545Ae5f1C7d2",
//       "fromBlock": 33145082,
//       "toBlock": 33166697,
//       "rewardsEarned": "42494298728159159084425"
//     },
//     {
//       "user": "0xCfb25Ed1F1b433f274Bc1E0640c8380421d0b9cf",
//       "fromBlock": 33145082,
//       "toBlock": 33166697,
//       "rewardsEarned": "257285846289474373959332"
//     },
//     ....

//block 33102633 to 33750394
function getTotalRewardsPerUser(jsonData) {
    const _totalEarnedRewardsByUser = earnedRewardsRawData.reduce(
        (acc, { user, rewardsEarned }) => {
            const rewards = BigInt(rewardsEarned);
            if (!acc[user]) {
                acc[user] = BigInt(0);
            }
            acc[user] += rewards;
            return acc;
        }, {}
    );
    const totalEarnedRewardsByUser = Object.entries(_totalEarnedRewardsByUser)
        .map(([user, rewardsEarned]) => ({
            user,
            rewardsEarnedWei: rewardsEarned.toString(),
            rewardsEarnedEther: (Number(rewardsEarned) / (1e18)).toFixed(7)
        }));
    return totalEarnedRewardsByUser;
}

function getTotalRewardsPerUserUptoBlock(jsonData, blockNumber) { }

function convertToCSV(data) {
    const header = "User,Rewards Earned (Wei),Rewards Earned (Ether)\n";
    const rows = data.map(({ user, rewardsEarnedWei, rewardsEarnedEther }) => `${user},${rewardsEarnedWei},${rewardsEarnedEther}`).join('\n');
    return header + rows;
}

async function main() {
    try {
        const totalRewardsPerUser = getTotalRewardsPerUser(earnedRewardsRawData);
        const filePath1 = "./totalRewardsEarnedPerUser33102633_33750394.json";
        const filePath2 = "./totalRewardsEarnedPerUser33102633_33750394.csv";
        fs.writeFileSync(filePath1, JSON.stringify(totalRewardsPerUser, null, 2), 'utf8');
        const csvData = convertToCSV(totalRewardsPerUser);
        fs.writeFileSync(filePath2, csvData, 'utf-8');
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});