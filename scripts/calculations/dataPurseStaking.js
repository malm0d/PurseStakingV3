const hre = require("hardhat");
const fs = require('fs');
const PURSESTAKING_ABI = require("../../abis/PurseStaking.json");
const PURSESTAKING_TREASURY_ABI = require("../../abis/PurseStakingTreasury.json");

// npx hardhat run --network bscmainnet scripts/calculations/dataPurseStaking.js
const endpoint = "https://bsc-mainnet.chainnodes.org/ca0d8638-3aff-4563-a8cb-e7e36ed32201";
const provider = new ethers.JsonRpcProvider(endpoint);
const PURSESTAKING_ADDRESS = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
const PURSESTAKING_TREASURY_ADDRESS = "0x6935a78b5ff92435662FB365085e5E490cC032C5";

const purseStakingContract = new hre.ethers.Contract(
    PURSESTAKING_ADDRESS,
    PURSESTAKING_ABI,
    provider
);

const purseStakingTreasuryContract = new hre.ethers.Contract(
    PURSESTAKING_TREASURY_ADDRESS,
    PURSESTAKING_TREASURY_ABI,
    provider
);

//Earliest block where PurseStaking contract recorded a transaction
const EARLIEST_BLOCK = 16525101;

//Block where V2 was upgraded to V3 and has claim rewards in Treasury
const UPGRADED_BLOCK_EVENT = 33652644;

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
    let withdrawUnlockedStakeEvents = [];
    let withdrawLockedStakeEvents = [];
    let claimedEvents = [];

    while (fromBlock <= toBlock) {
        try {
            let upperLimit = fromBlock + BATCH_SIZE;
            if (upperLimit > toBlock) {
                upperLimit = toBlock;  //Ensure we do not exceed toBlock
            }
            console.log("Checking block range: ", fromBlock, " to ", upperLimit);

            //Set null so we query all addresses
            const depositFilter = purseStakingContract.filters.Deposit(null)
            const withdrawUnlockedStakeFilter = purseStakingContract.filters.WithdrawUnlockedStake(null);
            const withdrawLockedStakeFilter = purseStakingContract.filters.WithdrawLockedStake(null);
            const claimedFilter = purseStakingTreasuryContract.filters.Claimed(null);

            const _depositEvents = await queryEvents(purseStakingContract, fromBlock, upperLimit, depositFilter);
            const _withdrawUnlockedStakeEvents = await queryEvents(purseStakingContract, fromBlock, upperLimit, withdrawUnlockedStakeFilter);
            const _withdrawLockedStakeEvents = await queryEvents(purseStakingContract, fromBlock, upperLimit, withdrawLockedStakeFilter);
            let _claimedEvents = [];
            if (fromBlock >= UPGRADED_BLOCK_EVENT) {
                _claimedEvents = await queryEvents(purseStakingTreasuryContract, fromBlock, upperLimit, claimedFilter);
            }

            let userAddress;
            let amount;
            let blockNumber;

            //------------------EVENT SIGNATURES------------------
            //event Deposit(address indexed _from, uint256 _value);
            //event WithdrawUnlockedStake(address indexed _from, uint256 _value);
            //event WithdrawLockedStake(address indexed _from, uint256 _value);
            //event Claimed(address indexed _address, uint256 indexed _amount, uint256 indexed _timestamp);
            //-----------------------------------------------------

            _depositEvents.forEach(async event => {
                userAddress = event.args._from;
                amount = BigInt(event.args._value.toString());
                blockNumber = event.blockNumber;
                console.log("Deposit: " + userAddress + " " + amount + " " + blockNumber);
                depositEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "Deposit",
                });
            });

            _withdrawUnlockedStakeEvents.forEach(async event => {
                userAddress = event.args._from;
                amount = BigInt(event.args._value.toString());
                blockNumber = event.blockNumber;
                console.log("WithdrawUnlockedStake: " + userAddress + " " + amount + " " + blockNumber);
                withdrawUnlockedStakeEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "WithdrawUnlockedStake",
                });
            });

            _withdrawLockedStakeEvents.forEach(async event => {
                userAddress = event.args._from;
                amount = BigInt(event.args._value.toString());
                blockNumber = event.blockNumber;
                console.log("WithdrawLockedStake: " + userAddress + " " + amount + " " + blockNumber);
                withdrawLockedStakeEvents.push({
                    userAddress: userAddress,
                    amount: amount.toString(),
                    blockNumber: blockNumber,
                    event: "WithdrawLockedStake",
                });
            });

            if (_claimedEvents.length > 0) {
                _claimedEvents.forEach(async event => {
                    userAddress = event.args._address;
                    amount = BigInt(event.args._amount.toString());
                    blockNumber = event.blockNumber;
                    console.log("Claimed: " + userAddress + " " + amount + " " + blockNumber);
                    claimedEvents.push({
                        userAddress: userAddress,
                        amount: amount.toString(),
                        blockNumber: blockNumber,
                        event: "Claimed",
                    });
                });
            }

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
    fs.writeFileSync('purseStakingAllDepositEvents.json', JSON.stringify(depositEvents, null, 2));
    fs.writeFileSync('purseStakingAllWithdrawUnlockedStakeEvents.json', JSON.stringify(withdrawUnlockedStakeEvents, null, 2));
    fs.writeFileSync('purseStakingAllWithdrawLockedStakeEvents.json', JSON.stringify(withdrawLockedStakeEvents, null, 2));
    fs.writeFileSync('purseStakingAllClaimedEvents.json', JSON.stringify(claimedEvents, null, 2));
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