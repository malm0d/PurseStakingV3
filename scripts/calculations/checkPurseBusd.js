const hre = require("hardhat");
const fs = require('fs');
const PURSE_BUSD_POOL_ABI = require("../../abis/PurseLPRestakePool.json");
const PURSE_BUSD_LPTOKEN_ABI = require("../../abis/PurseBusdLpToken.json");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");

//npx hardhat run --network bscmainnet scripts/calculations/checkPurseBusd.js

//1: https://bsc-mainnet.chainnodes.org/062698ce-0d9b-4eae-b9b8-e0525dafaa86
//2: https://bsc-mainnet.chainnodes.org/ca0d8638-3aff-4563-a8cb-e7e36ed32201
const endpoint = "https://bsc-mainnet.chainnodes.org/ca0d8638-3aff-4563-a8cb-e7e36ed32201";
const provider = new ethers.JsonRpcProvider(endpoint);
const PURSE_BUSD_POOL_ADDRESS = "0x439ec8159740a9B9a579F286963Ac1C050aF31C8";
const PURSE_BUSD_LPTOKEN_ADDRESS = "0x081F4B87F223621B4B31cB7A727BB583586eAD98";
const PURSE_ADDRESS = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
const PURSE_PER_BLOCK = BigInt("400000000000000000000");

//`fromBlock` is the earliest block for a user's last recorded 
//claim after purse rewards set to zero
let fromBlock = 22900257;

//`toBlock` is the block at which purse rewards was set to zero
let toBlock = 33742714;//33673092;

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

            depositEvents.forEach(async event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                let currentTotalStakedInPool = await getPoolTotalLPStaked(blockNumber);
                let userCurrentStaked = await getUserLpTokenStakedAmount(userAddress, blockNumber);
                console.log("Deposit: " + userAddress + " " + amount + " " + blockNumber);
                newDepositEventLogs.push({
                    user: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Deposit",
                    userCurrentStakedAmount: userCurrentStaked.toString(),
                    blockTotalStakedInPool: currentTotalStakedInPool.toString()
                });
            })

            withdrawEvents.forEach(async event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());
                blockNumber = event.blockNumber;
                let currentTotalStakedInPool = await getPoolTotalLPStaked(blockNumber);
                let userCurrentStaked = await getUserLpTokenStakedAmount(userAddress, blockNumber);
                console.log("Withdraw: " + userAddress + " " + amount + " " + blockNumber);
                newWithdrawEventLogs.push({
                    user: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Withdraw",
                    userCurrentStakedAmount: userCurrentStaked.toString(),
                    blockTotalStakedInPool: currentTotalStakedInPool.toString()
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

    fs.writeFileSync("purseBusdDepositsEvents2.json", JSON.stringify(newDepositEventLogs, null, 2));
    fs.writeFileSync("purseBusdWithdrawsEvents2.json", JSON.stringify(newWithdrawEventLogs, null, 2));
    fs.writeFileSync("purseBusdCombinedEvents2.json", JSON.stringify(userEvents, null, 2));

    return userEvents;
}

function extractSequenceOfEvents(userEvents) {
    let combined = [];
    for (let user in userEvents) {
        if (userEvents.hasOwnProperty(user)) {
            combined = combined.concat(userEvents[user]);
        }
    }
    combined.sort((a, b) => a.blockNumber - b.blockNumber);
    fs.writeFileSync("purseBusdSequenceEvents2.json", JSON.stringify(combined, null, 2))
    return combined;

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
//{ user0: [event0, event1, ...], user1: [event0, event1, ...], userN: [], ...  }
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

async function tallyEarnedRewardsPerUser(_sequenceOfEvents, _userEventsFiltered, _userRange) {
    const logFileName = "purseBusdUserEarnedRewardsRaw2.json";

    console.log("Total users to check: " + Object.keys(_userEventsFiltered).length);
    const usersOfInterest = Object.keys(_userEventsFiltered);

    const sequenceOfEvents = _sequenceOfEvents;

    let userLog = {};
    for (let user of usersOfInterest) {
        let userEntries = [];

        console.log("Checking user: " + user);
        const startingBlock = _userRange[user].fromBlock;
        const finalBlock = _userRange[user].toBlock;
        let fromBlock = _userRange[user].fromBlock;
        let toBlock = _userRange[user].toBlock;

        //get staked amount and total staked in pool at `fromBlock`
        let userStakedAmount = await getUserLpTokenStakedAmount(user, fromBlock + 1);
        let totalStakedInPool = await getPoolTotalLPStaked(fromBlock - 1);
        let userRewardsEarned = BigInt(0);

        //log initial values
        let firstEntry = {
            user: user,
            fromBlock: startingBlock,
            toBlock: startingBlock,
            userStakedAmount: userStakedAmount.toString(),
            totalStakedInPool: totalStakedInPool.toString(),
            rewardsEarnedWei: 0,
            rewardsEarnedEther: 0,
            eventThatTriggerRewards: null,
            updateUserStakedAmountForNext: false,
            updateTotalStakedInPoolForNext: false
        }
        userEntries.push(firstEntry);

        console.log("Checking events for user: " + user);
        console.log("Checking total number of events in block frame: " + sequenceOfEvents.length);

        //calculate the rewards earned from the last event to the current event.
        //the rewards earned should be based on user staked amount and total staked in pool
        //at the last event block number, and the number of blocks elapsed since last event
        for (let i = 0; i < sequenceOfEvents.length; i++) {
            let event = sequenceOfEvents[i];
            if (event.blockNumber < fromBlock) {
                console.log("Skipping event for user: " + user + " at block: " + event.blockNumber + " because it is before the `fromBlock`: " + fromBlock);
                console.log();
                continue;
            }
            if (event.blockNumber > toBlock) {
                console.log("Skipping event for user: " + user + " at block: " + event.blockNumber + " because it is after the `toBlock`: " + toBlock);
                console.log();
                break;
            }
            //if event is the user, then we need to calculate the rewards earned and update
            //the user's staked amount and total staked in pool for next event
            if (event.user.toLowerCase() === user) {
                let rewardsEarnedSinceLastEvent = calculateRewardsEarnedFromLastEvent(
                    userStakedAmount,
                    totalStakedInPool,
                    fromBlock,
                    event.blockNumber
                );

                userRewardsEarned += rewardsEarnedSinceLastEvent;

                //log event
                let newEntry = {
                    user: user,
                    fromBlock: fromBlock,
                    toBlock: event.blockNumber,
                    userStakedAmount: userStakedAmount.toString(),
                    totalStakedInPool: totalStakedInPool.toString(),
                    rewardsEarnedWei: userRewardsEarned.toString(),
                    rewardsEarnedEther: (Number(userRewardsEarned) / (1e18)).toFixed(10),
                    eventThatTriggerRewards: event,
                    updateUserStakedAmountForNext: true,
                    updateTotalStakedInPoolForNext: true
                }
                userEntries.push(newEntry);

                //update user's staked amount and total staked in pool for next event
                if (event.event === "Deposit") {
                    userStakedAmount += BigInt(event.amount);
                    totalStakedInPool += BigInt(event.amount);
                } else if (event.event === "Withdraw") {
                    userStakedAmount -= BigInt(event.amount);
                    totalStakedInPool -= BigInt(event.amount);
                }
            }
            //if event is not the user, then we need to calculate the rewards earned and update
            //the total staked in pool for next event
            else {
                let rewardsEarnedSinceLastEvent = calculateRewardsEarnedFromLastEvent(
                    userStakedAmount,
                    totalStakedInPool,
                    fromBlock,
                    event.blockNumber
                );

                userRewardsEarned += rewardsEarnedSinceLastEvent;

                //log event
                let newEntry = {
                    user: user,
                    fromBlock: fromBlock,
                    toBlock: event.blockNumber,
                    userStakedAmount: userStakedAmount.toString(),
                    totalStakedInPool: totalStakedInPool.toString(),
                    rewardsEarnedWei: userRewardsEarned.toString(),
                    rewardsEarnedEther: (Number(userRewardsEarned) / (1e18)).toFixed(10),
                    eventThatTriggerRewards: event,
                    updateUserStakedAmountForNext: false,
                    updateTotalStakedInPoolForNext: true
                }
                userEntries.push(newEntry);

                //only update total staked in pool for next event
                if (event.event === "Deposit") {
                    totalStakedInPool += BigInt(event.amount);
                } else if (event.event === "Withdraw") {
                    totalStakedInPool -= BigInt(event.amount);
                }
            }

            //update `fromBlock` to the current event block number
            fromBlock = event.blockNumber;
        }

        //after the loop, we will have the total rewards earned for the user, up to the last event.
        //now we need to calculate the rewards earned from the last event to the `toBlock`
        //(block at which purse rewards was set to zero)
        let finalRewardsEarned = calculateRewardsEarnedFromLastEvent(
            userStakedAmount,
            totalStakedInPool,
            fromBlock,
            finalBlock
        );
        userRewardsEarned += finalRewardsEarned;

        //log final entry
        let finalEntry = {
            user: user,
            fromBlock: fromBlock,
            toBlock: finalBlock,
            userStakedAmount: userStakedAmount.toString(),
            totalStakedInPool: totalStakedInPool.toString(),
            rewardsEarnedWei: userRewardsEarned.toString(),
            rewardsEarnedEther: (Number(userRewardsEarned) / (1e18)).toFixed(10),
            eventThatTriggerRewards: null,
            updateUserStakedAmountForNext: false,
            updateTotalStakedInPoolForNext: false
        }

        userEntries.push(finalEntry);
        userLog[user] = userEntries;
    }

    fs.writeFileSync(logFileName, JSON.stringify(userLog, null, 2));
    return userLog;
}

function getFinalEarnedRewardValues(earnedRewardsResult) {
    let result = {};
    let fromBlock;
    let toBlock;
    for (let user in earnedRewardsResult) {
        let entries = earnedRewardsResult[user];
        let finalEntry = entries[entries.length - 1];
        fromBlock = entries[0].fromBlock;
        toBlock = finalEntry.toBlock;
        finalEntry.fromBlock = fromBlock;
        finalEntry.toBlock = toBlock;
        result[user] = finalEntry;
    }
    //parse to csv
    const header = "User,Rewards Earned (Wei),Rewards Earned (Ether),From Block, To Block\n";
    const rows = Object.entries(result).map(([
        userKey, { rewardsEarnedWei, rewardsEarnedEther, fromBlock, toBlock }
    ]) => `${userKey},${rewardsEarnedWei},${rewardsEarnedEther},${fromBlock},${toBlock}`).join('\n');
    const csvData = header + rows;
    fs.writeFileSync("purseBusdUserEarnedRewardsFinal2.csv", csvData, 'utf-8');
    fs.writeFileSync("purseBusdUserEarnedRewardsFinal2.json", JSON.stringify(result, null, 2));
    return result;
}


async function main() {
    // console.log("Getting user events");
    // let userEvents = await getEvents(fromBlock, toBlock, batchSize);
    // console.log("User events retrieved.")

    const userBlockRange = JSON.parse(fs.readFileSync("impactedUsers2.json", 'utf8'));
    console.log(userBlockRange);
    console.log();

    const impactedAddresses = Object.keys(userBlockRange);
    console.log(impactedAddresses);
    console.log();

    userEvents = JSON.parse(fs.readFileSync("./purseBusdCombinedEvents2.json", 'utf8'));
    userEvents = prepEventsData(userEvents);
    //console.log(userEvents);

    const sequenceOfEvents = extractSequenceOfEvents(userEvents);
    //console.log(sequenceOfEvents);

    //If user in `userEventsFiltered` does not have any events, means that user does not have
    //deposit or withdraw event between the `fromBlock` and `toBlock` range.
    const userEventsFiltered = filterUserEventsByAddresses(userEvents, impactedAddresses);
    console.log("All User deposit & withdraw events between block range: " + fromBlock + " to " + toBlock + " filtered by impacted addresses:");
    console.log(userEventsFiltered);
    console.log();


    const earnedRewardsResult = await tallyEarnedRewardsPerUser(sequenceOfEvents, userEventsFiltered, userBlockRange);
    //console.log("Earned rewards result:");
    //console.log(earnedRewardsResult);

    const finalEarnedRewardValues = getFinalEarnedRewardValues(earnedRewardsResult);
    console.log("Final earned rewards result:");
    console.log(finalEarnedRewardValues);

    // const originalTotal = BigInt("104903780071000742319900")
    //     + BigInt("257593361472049017641626")
    //     + BigInt("546253633960647171721403")
    //     + BigInt("156521576848631373786003")
    //     + BigInt("26731229550152059823608")
    // console.log("Original Total");
    // console.log("Wei: " + originalTotal.toString());
    // console.log("Ether: " + Number(originalTotal) / (1e18));
    // console.log();

    // const newTotal = BigInt("222330127129817183020602")
    //     + BigInt("260225152791323100750637")
    //     + BigInt("584202601658912715386060")
    //     + BigInt("160288281937132021145514")
    //     + BigInt("29190599977678429294523")
    // console.log("New Total");
    // console.log("Wei: " + newTotal.toString());
    // console.log("Ether: " + Number(newTotal) / (1e18));
    // console.log();

    // const diff = newTotal - originalTotal;
    // console.log("Difference");
    // console.log("Wei: " + diff.toString());
    // console.log("Ether: " + Number(diff) / (1e18));
    // console.log();

    // const user1Diff = BigInt("222330127129817183020602") - BigInt("104903780071000742319900");
    // console.log("User1 Difference");
    // console.log("Wei: " + user1Diff.toString());
    // console.log("Ether: " + Number(user1Diff) / (1e18));
    // console.log();

    // const user2Diff = BigInt("260225152791323100750637") - BigInt("257593361472049017641626");
    // console.log("User2 Difference");
    // console.log("Wei: " + user2Diff.toString());
    // console.log("Ether: " + Number(user2Diff) / (1e18));
    // console.log();

    // const user3Diff = BigInt("584202601658912715386060") - BigInt("546253633960647171721403");
    // console.log("User3 Difference");
    // console.log("Wei: " + user3Diff.toString());
    // console.log("Ether: " + Number(user3Diff) / (1e18));
    // console.log();

    // const user4Diff = BigInt("160288281937132021145514") - BigInt("156521576848631373786003");
    // console.log("User4 Difference");
    // console.log("Wei: " + user4Diff.toString());
    // console.log("Ether: " + Number(user4Diff) / (1e18));
    // console.log();

    // const user5Diff = BigInt("29190599977678429294523") - BigInt("26731229550152059823608");
    // console.log("User5 Difference");
    // console.log("Wei: " + user5Diff.toString());
    // console.log("Ether: " + Number(user5Diff) / (1e18));
    // console.log();

    // const diffTotal = user1Diff + user2Diff + user3Diff + user4Diff + user5Diff;
    // console.log("Difference Total");
    // console.log("Wei: " + diffTotal.toString());
    // console.log("Ether: " + Number(diffTotal) / (1e18));

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});