const data = require("../eventLogs.json");
const fs = require('fs');
//npx hardhat run scripts/parsePurseWfxDepositData.js

function getUsersByAmount(jsonData) {
    const amountsByUser = data.reduce((acc, { user, amount }) => {
        if (!acc[user]) {
            acc[user] = BigInt(0);
        }
        acc[user] += BigInt(amount);
        return acc;
    }, {});
    console.log(amountsByUser);
    const users = Object.entries(amountsByUser)
        .sort((a, b) => {
            //a , b == first user, second user; [1] == amount
            if (a[1] > b[1]) return -1;
            if (a[1] < b[1]) return 1;
            return 0;
        })
        .map(([user, amount]) => ({
            user,
            amountWei: amount.toString(),
            amountEther: (Number(amount) / (1e18)).toFixed(5)
        }));

    return users;
}

function convertToCSV(data) {
    const header = "User,Amount (Wei),Amount (Ether)\n";
    const rows = data.map(({ user, amountWei, amountEther }) => `${user},${amountWei},${amountEther}`).join('\n');
    return header + rows;
}

async function main() {
    try {
        const usersSortedByAmount = getUsersByAmount(data);
        const filePath1 = "./sortedUsers.json";
        const filePath2 = "./sortedUsers.csv";
        fs.writeFileSync(filePath1, JSON.stringify(usersSortedByAmount, null, 2), 'utf8');
        const csvData = convertToCSV(usersSortedByAmount);
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