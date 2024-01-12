const hre = require("hardhat");
const fs = require('fs');
const PANCAKE_LP_RESTAKE_ABI = require("../../abis/PurseLPRestakePool.json");

// npx hardhat run --network bscmainnet scripts/calculations/dataPancakeSwapPool.js
const endpoint = "https://bsc-mainnet.chainnodes.org/ca0d8638-3aff-4563-a8cb-e7e36ed32201";
const provider = new ethers.JsonRpcProvider(endpoint);
const PANCAKE_LP_RESTAKE_ADDRESS = "0x439ec8159740a9B9a579F286963Ac1C050aF31C8";

const pancakeLpRestakePoolContract = new hre.ethers.Contract(
    PANCAKE_LP_RESTAKE_ADDRESS,
    PANCAKE_LP_RESTAKE_ABI,
    provider
);

//Earliest block where PancakeLpRestakePool contract recorded a transaction
const EARLIEST_BLOCK = 13250931;

async function queryEvents(contract, fromBlock, toBlock, filter) {
    try {
        return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
        console.log("Error querying events: ", error.message);
        throw error; // Re-throw the error to be caught by the retry logic
    }
}

async function getEvents(_fromBlock, _toBlock) {
    const BATCH_SIZE = 10000;
    let fromBlock = _fromBlock;
    let toBlock = _toBlock;

    let retries = 0;
    const maxRetries = 1000;
    const retryDelay = 5000; // 5 seconds

    let depositEvents = [];
    let withdrawEvents = [];
    let claimedEvents = [];

    while (fromBlock <= toBlock) {
        try {
            let upperLimit = fromBlock + BATCH_SIZE;
            if (upperLimit > toBlock) {
                upperLimit = toBlock;  //Ensure we do not exceed toBlock
            }
            console.log("Checking block range: ", fromBlock, " to ", upperLimit);

            //Set null so we query all addresses
            const depositFilter = pancakeLpRestakePoolContract.filters.Deposit(null);
            const withdrawFilter = pancakeLpRestakePoolContract.filters.Withdraw(null);
            const claimFilter = pancakeLpRestakePoolContract.filters.ClaimReward(null);

            const _depositEvents = await queryEvents(pancakeLpRestakePoolContract, fromBlock, upperLimit, depositFilter);
            const _withdrawEvents = await queryEvents(pancakeLpRestakePoolContract, fromBlock, upperLimit, withdrawFilter);
            const _claimEvents = await queryEvents(pancakeLpRestakePoolContract, fromBlock, upperLimit, claimFilter);

            let userAddress;
            let amount;
            let blockNumber;

            //------------------EVENT SIGNATURES------------------
            // event Deposit(address indexed user, uint256 amount);
            // event Withdraw(address indexed user, uint256 amount);
            // event ClaimReward(address indexed user, uint256 amount);
            //-----------------------------------------------------

            _depositEvents.forEach(async event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                console.log("Desposit: " + userAddress + " " + amount + " " + blockNumber);
                depositEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Deposit"
                });
            });

            _withdrawEvents.forEach(async event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                console.log("Withdraw: " + userAddress + " " + amount + " " + blockNumber);
                withdrawEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Withdraw"
                });
            });

            _claimEvents.forEach(async event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                console.log("ClaimReward: " + userAddress + " " + amount + " " + blockNumber);
                claimedEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "ClaimReward"
                });
            });

            fromBlock = upperLimit + 1; //Set fromBlock to the next block so no overlap
            retries = 0; //Reset retries

        } catch (error) {
            if (retries >= maxRetries) {
                console.log("Max retries reached, exiting...");
                throw error;
            }
            console.log(`Retrying... Attempt ${retries + 1} of ${maxRetries}`);
            retries++;
            await new Promise(r => setTimeout(r, retryDelay));
        }
    }

    console.log("Writing to file...");
    fs.writeFileSync('pancakeLpRestakePoolDepositEvents.json', JSON.stringify(depositEvents, null, 2));
    fs.writeFileSync('pancakeLpRestakePoolWithdrawEvents.json', JSON.stringify(withdrawEvents, null, 2));
    fs.writeFileSync('pancakeLpRestakePoolClaimedRewardEvents.json', JSON.stringify(claimedEvents, null, 2));
    console.log("Files written.");
}

async function main() {
    console.log("Starting process...");
    const LATEST_BLOCK = await provider.getBlockNumber();
    console.log("Latest block: ", LATEST_BLOCK);
    await getEvents(EARLIEST_BLOCK, LATEST_BLOCK);
    console.log("Process Completed");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});