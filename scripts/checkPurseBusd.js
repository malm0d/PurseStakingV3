const hre = require("hardhat");
const fs = require('fs');
const PURSE_BUSD_POOL_ABI = require("../test/PurseBusdPool.json");
const PURSE_BUSD_LPTOKEN_ABI = require("../test/PurseBusdLpToken.json");
const PURSE_BSC_ABI = require("../test/PurseBsc.json");

//npx hardhat run --network bscmainnet scripts/checkPurseBusd.js

const endpoint = "https://bsc-mainnet.chainnodes.org/062698ce-0d9b-4eae-b9b8-e0525dafaa86";
const provider = new ethers.JsonRpcProvider(endpoint);
const PURSE_BUSD_POOL_ADDRESS = "0x439ec8159740a9B9a579F286963Ac1C050aF31C8";
const PURSE_BUSD_LPTOKEN_ADDRESS = "0x081F4B87F223621B4B31cB7A727BB583586eAD98";
const PURSE_ADDRESS = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
const PURSE_PER_BLOCK = BigInt("400000000000000000000");

//`fromBlock` is the earliest block for a user's last recorded 
//claim after purse rewards set to zero
let fromBlock = 22900257;

//`toBlock` is the block at which purse rewards was set to zero
let toBlock = 33673092;

const batchSize = 10000;

const purseBusdContract = new hre.ethers.Contract(
    PURSE_BUSD_POOL_ADDRESS,
    PURSE_BUSD_POOL_ABI,
    provider
);

const purseBusdLpTokenContract = new hre.ethers.Contract(
    PURSE_BUSD_LPTOKEN_ADDRESS,
    PURSE_BUSD_LPTOKEN_ABI,
    provider
);

const purseContract = new hre.ethers.Contract(
    PURSE_ADDRESS,
    PURSE_BSC_ABI,
    provider
);

async function queryEvents(provider, contract, fromBlock, toBlock, filter) {
    try {
        return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
        console.error("Error querying events:", error.message);
        throw error;  // Re-throw the error to be caught by the retry logic
    }
}

//Get all user addresses and their deposit and withdraw events (sorted by block number) in block range
async function getEvents(_fromBlock, _toBlock, _batchSize) {
    let fromBlock = _fromBlock;
    let toBlock = _toBlock;
    const batchSize = _batchSize;
    let retries = 0;
    const maxRetries = 100;
    const retryDelay = 5000;

    let newDepositEventLogs = [];
    let newWithdrawEventLogs = [];
    let userEvents = {};
    while (fromBlock <= toBlock) {
        try {
            let upperLimit = fromBlock + batchSize;
            if (upperLimit > toBlock) {
                upperLimit = toBlock; // Adjust to ensure we don't exceed toBlock
            }
            console.log("Checking block range: " + fromBlock + " to " + upperLimit);
            const depositFilter = purseBusdContract.filters.Deposit(null);
            const withdrawFilter = purseBusdContract.filters.Withdraw(null);
            const depositEvents = await queryEvents(provider, purseBusdContract, fromBlock, upperLimit, depositFilter);
            const withdrawEvents = await queryEvents(provider, purseBusdContract, fromBlock, upperLimit, withdrawFilter);

            let userAddress;
            let amount;
            let blockNumber;

            depositEvents.forEach(event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                console.log("Deposit: " + userAddress + " " + amount + " " + blockNumber);
                newDepositEventLogs.push({
                    user: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Deposit"
                });

            })

            withdrawEvents.forEach(event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                console.log("Withdraw: " + userAddress + " " + amount + " " + blockNumber);
                newWithdrawEventLogs.push({
                    user: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Withdraw"
                });
            })
            fromBlock = upperLimit + 1; //no overlap
            retries = 0;
        } catch (err) {
            if (retries >= maxRetries) {
                console.error("Maximum retries reached. Exiting.");
                throw err;
            }
            console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`);
            retries++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    newDepositEventLogs.forEach(event => {
        if (!userEvents[event.user]) {
            userEvents[event.user] = [];
        }
        userEvents[event.user].push(event);
    });
    newWithdrawEventLogs.forEach(event => {
        if (!userEvents[event.user]) {
            userEvents[event.user] = [];
        }
        userEvents[event.user].push(event);
    });

    for (let user in userEvents) {
        userEvents[user].sort((a, b) => {
            if (a.blockNumber < b.blockNumber) return -1;
            if (a.blockNumber > b.blockNumber) return 1;
            return 0;
        });
    }

    fs.writeFileSync("purseBusdDepositsEvents.json", JSON.stringify(newDepositEventLogs, null, 2));
    fs.writeFileSync("purseBusdWithdrawsEvents.json", JSON.stringify(newWithdrawEventLogs, null, 2));
    fs.writeFileSync("purseBusdCombinedEvents.json", JSON.stringify(userEvents, null, 2));

    return userEvents;
}

//Convert all addresses to lowercase
function prepEventsData(userEvents) {
    let newData = {};
    for (let user in userEvents) {
        if (userEvents.hasOwnProperty(user)) {
            let lowercase = user.toLowerCase();
            newData[lowercase] = userEvents[user].map(event => {
                return { ...event, user: event.user.toLowerCase() };
            });
        }
    }
    return newData;
}

//Given an `addressesToFilterFor` array, filters the userEvents object for user 
//addresses that are in the `addressesToFilterFor` array. Returns a new object
//with the filtered user addresses, if the user address is not in the `addressesToFilterFor`
// array, then the user address is added to the new object with an empty array.
function filterUserEventsByAddresses(userEvents, addressesToFilterFor) {
    let filteredEvents = {};
    addressesToFilterFor.forEach(address => {
        if (userEvents.hasOwnProperty(address)) {
            filteredEvents[address] = userEvents[address];
        } else {
            filteredEvents[address] = [];
        }
    });
    return filteredEvents;
}


async function getPoolTotalLPStaked(blockNumber) {
    const totalStaked = await purseBusdLpTokenContract.balanceOf(PURSE_BUSD_POOL_ADDRESS, { blockTag: blockNumber });
    return totalStaked; //BigInt
}

async function getUserLpTokenStakedAmount(user, blockNumber) {
    let stakedAmount;
    try {
        let _stakedAmount = await purseBusdContract.userInfo(
            PURSE_BUSD_LPTOKEN_ADDRESS,
            user,
            { blockTag: blockNumber }
        );
        stakedAmount = _stakedAmount[0];
    } catch (error) {
        console.error("Error getting staked amount for user: " + user);
    }
    return stakedAmount; //BigInt

}

function getAllEventsBlockNumbers(userEvents) {
    let blockNumbersToCheck = [];
    for (let user in userEvents) {
        userEvents[user].forEach(event => {
            blockNumbersToCheck.push(event.blockNumber);
        });
    }
    //sort and remove duplicates
    blockNumbersToCheck.sort((a, b) => a - b);
    blockNumbersToCheck = [...new Set(blockNumbersToCheck)];
    //add last block so we can calculate the rewards earned from last
    //event to the `toBlock` (block at which purse rewards was set to zero)
    blockNumbersToCheck.push(toBlock);
    return blockNumbersToCheck;
}

//Maps: user => [blockNumber, blockNumber, ...]
function getUserEventsBlockNumbers(userEvents) {
    let usersAndBlockNumbers = {};
    for (let user in userEvents) {
        usersAndBlockNumbers[user] = [];
        userEvents[user].forEach(event => {
            usersAndBlockNumbers[user].push(event.blockNumber);
        });
    }
    return usersAndBlockNumbers;
}

//Given a userAddresses array
//Filters for user addresses that are in the `addressesToFilterFor` array
function filterUserAddresses(userAddresses, addressesToFilterFor) {
    let filteredAddresses = [];
    for (let i = 0; i < userAddresses.length; i++) {
        if (addressesToFilterFor.includes(userAddresses[i])) {
            filteredAddresses.push(userAddresses[i]);
        }
    }
    return filteredAddresses;
}

//Calculate rewards earned by user from last event to current block
function calculateRewardsEarnedFromLastEvent(userStakedAmount, totalStakedInPool, fromBlock, toBlock) {
    let blockRewards = BigInt(0);
    let blockDifference = toBlock - fromBlock;
    if (blockDifference == 0) {
        return blockRewards;
    } else {
        blockRewards = BigInt(blockDifference) * PURSE_PER_BLOCK;
    }
    //BigInt acts like fixed point arithmetic so multiply first then divide
    const rewardsEarned = (userStakedAmount * blockRewards) / totalStakedInPool;
    return rewardsEarned; // BigInt
}

async function tallyRewardsEarnedPerUser(userEvents, addressesToFilterFor) {
    const logFileName = "purseBusdUserEarnedRewards.json";
    const _maxRetries = 1000;
    const _retryDelay = 5000;

    let userAddresses = Object.keys(userEvents);
    userAddresses = filterUserAddresses(userAddresses, addressesToFilterFor);
    console.log("Total users to check: " + userAddresses.length);
    const blockNumbersToCheck = getAllEventsBlockNumbers(userEvents);

    // Load existing data, if any
    let existingData = fs.existsSync(logFileName) ? JSON.parse(fs.readFileSync(logFileName, 'utf8')) : [];

    for (let i = 0; i < blockNumbersToCheck.length - 1; i++) {
        const _fromBlock = blockNumbersToCheck[i];
        const _toBlock = blockNumbersToCheck[i + 1];
        console.log("-------Calculating for rewards block range: " + _fromBlock + " to " + _toBlock + "-------");

        for (const _userAddress of userAddresses) {
            if (existingData.some(
                entry => entry.user === _userAddress
                    && entry.fromBlock === _fromBlock
                    && entry.toBlock === _toBlock
            )) {
                console.log("Already processed user: " + _userAddress + " for block range: " + _fromBlock + " to " + _toBlock + ". Skipping...");
                continue;
            }
            let _userStakedAmount;
            let _totalStakedInPool;
            let retries = 0;

            while (retries < _maxRetries) {
                try {
                    _userStakedAmount = await getUserLpTokenStakedAmount(_userAddress, _fromBlock);
                    _totalStakedInPool = await getPoolTotalLPStaked(_fromBlock);
                    break;

                } catch (error) {
                    console.error("Error getting staked amount for user: " + _userAddress + " Retrying...");
                    retries++;
                    console.log("Attempt " + retries + "/" + _maxRetries);
                    console.log();
                    await new Promise(resolve => setTimeout(resolve, _retryDelay));
                }
            }
            const _rewardsEarnedSinceLastEvent = calculateRewardsEarnedFromLastEvent(
                _userStakedAmount,
                _totalStakedInPool,
                _fromBlock,
                _toBlock
            );
            console.log("User: " + _userAddress + " Rewards: " + _rewardsEarnedSinceLastEvent);
            console.log();
            let newRewardsEntry = {
                user: _userAddress,
                fromBlock: _fromBlock,
                toBlock: _toBlock,
                rewardsEarned: _rewardsEarnedSinceLastEvent.toString(),
            };
            existingData.push(newRewardsEntry);
            fs.writeFileSync(logFileName, JSON.stringify(existingData, null, 2));
        }
    }
    console.log("Completed.");
}

async function tallyEarnedRewardsPerUser(_userEventsFiltered, _userRange) {
    const logFileName = "purseBusdUserEarnedRewards.json";
    const _maxRetries = 1000;
    const _retryDelay = 5000;

    let existingData = fs.existsSync(logFileName)
        ? JSON.parse(fs.readFileSync(logFileName, 'utf8'))
        : [];

    console.log("Total users to check: " + Object.keys(_userEventsFiltered).length);

    for (let user in _userEventsFiltered) {

    }

}

async function main() {
    // console.log("Getting user events");
    // const userEvents = await getEvents(fromBlock, toBlock, batchSize);
    // console.log("User events retrieved.")
    const impactedAddresses = [
        "0xb6f9e4c6db0c4f3a7e8aff01077e601a7626409b",
        "0xfa235972863481090c2e91d519810596a9ec1af4",
        "0xbeadb1638cb46de09b691a11a9070d284445dfee",
        "0x1ac8d5f6fd417ab2909a310ba671500ceabc0aed",
        "0x30c568c5d6f9fb383986cfd6dd99effc0444b869"
    ]

    const userRange = {
        "0xb6f9e4c6db0c4f3a7e8aff01077e601a7626409b": {
            fromBlock: 33651665,
            toBlock: 33673092
        },
        "0xfa235972863481090c2e91d519810596a9ec1af4": {
            fromBlock: 22900257,
            toBlock: 33673092
        },
        "0xbeadb1638cb46de09b691a11a9070d284445dfee": {
            fromBlock: 32853115,
            toBlock: 33673092
        },
        "0x1ac8d5f6fd417ab2909a310ba671500ceabc0aed": {
            fromBlock: 32117788,
            toBlock: 33673092
        },
        "0x30c568c5d6f9fb383986cfd6dd99effc0444b869": {
            fromBlock: 32562249,
            toBlock: 33673092
        },
    }

    let userEvents = JSON.parse(fs.readFileSync("purseBusdCombinedEvents.json", 'utf8'));
    userEvents = prepEventsData(userEvents);
    console.log(userEvents);
    //If user in `userEventsFiltered` does not have any events, means that user does not have
    //deposit or withdraw event between the `fromBlock` and `toBlock` range.
    const userEventsFiltered = filterUserEventsByAddresses(userEvents, impactedAddresses);
    console.log("All User deposit & withdraw events between block range: " + fromBlock + " to " + toBlock + " filtered by impacted addresses:");
    console.log(userEventsFiltered);
    console.log();
    //Create a map of address to block number so its easier to track.
    const userEventsBlockNumbers = getUserEventsBlockNumbers(userEventsFiltered);
    console.log("User deposit and withdraw events block numbers:");
    console.log(userEventsBlockNumbers);
    console.log();

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});