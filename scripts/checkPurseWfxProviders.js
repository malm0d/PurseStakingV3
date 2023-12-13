const hre = require("hardhat");
const FACTORY_ABI = require("../abis/Factory.json");
const WFX_ABI = require("../abis/WFX_Upgradeable.json");
const PURSE_ABI = require("../abis/Purse.json");
const PAIR_ABI = require("../abis/Pair.json");
const MASTER_CHEF_ABI = require("../abis/MasterChefV2.json");
const fs = require('fs');
const path = require('path');

//npx hardhat run --network fxMainnet scripts/checkPurseWfxProviders.js

async function queryEvents(provider, contract, fromBlock, toBlock, filter) {
    try {
        return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
        console.error("Error querying events:", error.message);
        throw error;  // Re-throw the error to be caught by the retry logic
    }
}

async function main() {
    const FACTORY_ADDRESS = "0x9E229BE3812228454499FAf771b296bedFe8c904";
    const WFX_ADDRESS = "0x80b5a32E4F032B2a058b4F29EC95EEfEEB87aDcd";
    const PURSE_ADDRESS = "0x5FD55A1B9FC24967C4dB09C513C3BA0DFa7FF687";
    const PURSE_WFX_PAIR_ADDRESS = "0x4d7F3396ab3E8d680F7bbd332D1FE452E2a7dA6f";
    const MASTERCHEF_ADDRESS = "0x4bd522b2E25f6b1A874C78518EF25f5914C522dC";

    const provider = new ethers.JsonRpcProvider("https://fx-json-web3.functionx.io:8545")

    const purseWfxPair = new hre.ethers.Contract(
        PURSE_WFX_PAIR_ADDRESS,
        PAIR_ABI,
        provider
    );

    const masterchef = new hre.ethers.Contract(
        MASTERCHEF_ADDRESS,
        MASTER_CHEF_ABI,
        provider
    );

    // let fromBlock = 8000000;
    let fromBlock = 7273000;
    let currentBlock = await provider.getBlockNumber();
    console.log(currentBlock);
    const batchSize = 10000;
    let retries = 0;
    const maxRetries = 10000;
    const retryDelay = 5000;

    const logFileName = 'eventLogs.json';
    let liquidityProviders = new Map();

    if (fs.existsSync(logFileName)) {
        const existingData = fs.readFileSync(logFileName, 'utf8');
        const parsedData = existingData ? JSON.parse(existingData) : [];

        parsedData.forEach(entry => {
            liquidityProviders.set(entry.user, BigInt(entry.amount));
        });

        // Determine the last processed block
        const lastProcessedBlock = parsedData.length > 0 ? parsedData[parsedData.length - 1].blockNumber : fromBlock;
        fromBlock = lastProcessedBlock + 1;
    }

    let newProvidersData = [];
    while (fromBlock < currentBlock) {
        let toBlock = (fromBlock + batchSize > currentBlock) ? currentBlock : fromBlock + batchSize;
        console.log()
        console.log("From Block:", fromBlock, "To Block:", toBlock)
        console.log()
        try {
            const filter = masterchef.filters.Deposit(null, 2, null);
            const events = await queryEvents(provider, masterchef, fromBlock, toBlock, filter)
            console.log("Checking events")
            let userAddress;
            let amount;
            events.forEach(event => {
                userAddress = event.args.user;
                amount = BigInt(event.args.amount.toString());

                if (!liquidityProviders[userAddress]) {
                    liquidityProviders[userAddress] = BigInt(0);
                }

                liquidityProviders[userAddress] = liquidityProviders[userAddress] + amount
                console.log("User:", userAddress, "Amount:", liquidityProviders[userAddress].toString());
                console.log()

                newProvidersData.push({
                    user: userAddress,
                    amount: liquidityProviders[userAddress].toString(),
                    blockNumber: event.blockNumber
                });
            });

            let existingData = [];
            if (fs.existsSync(logFileName)) {
                existingData = JSON.parse(fs.readFileSync(logFileName, 'utf8'));
            }
            const combinedData = existingData.concat(newProvidersData);
            fs.writeFileSync(logFileName, JSON.stringify(combinedData, null, 2));

            newProvidersData = [];
            fromBlock = toBlock + 1;
            retries = 0;

        } catch (error) {
            if (retries >= maxRetries) {
                console.error("Maximum retries reached. Exiting.");
                throw error;
            }
            console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`);
            retries++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    // Convert to array and sort by amount
    const sortedProviders = Object.entries(liquidityProviders)
        .map(([user, amount]) => ({ user, amount: amount.toString() }))
        .sort((a, b) => {
            const bigA = BigInt(a.amount);
            const bigB = BigInt(b.amount);
            return bigA > bigB ? -1 : bigA < bigB ? 1 : 0;
        })

    console.log("Top Liquidity Providers for Pool ID 2:", sortedProviders);


    //DONT USE THIS, PROCESS THE eventLogs.json file instead
    const fileName = 'top-liquidity-providers.json';
    fs.writeFile(fileName, JSON.stringify(sortedProviders, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('An error occurred while writing JSON to file:', err);
        } else {
            console.log(`Data written to file ${fileName}`);
        }
    });

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});