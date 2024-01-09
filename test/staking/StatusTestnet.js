const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("../../abis/BEP20.json");
require("dotenv").config();

//npx hardhat test test/staking/StatusTestnet.js --network bsctestnet
describe("Test", function () {
    const PURSE_STAKING = "PurseStakingV3v";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKINGADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const DISTRIBUTORADDRESS = "0xdb307306ae74EefaCf26afdca25C5A11D5b7e09e";
    const TREASURYADDRESS = "0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB";

    let owner;
    let ownerAddress;
    let userB;
    let userC;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        ownerAddress = signers[0].address;
        userB = signers[1].address;
        userC = signers[2].address;
    });

    it("PurseStaking", async () => {
        console.log(owner.address)
        token = await hre.ethers.getContractAt(
            BEP20ABI,
            PURSE,
            owner
        );

        purseStaking = await hre.ethers.getContractAt(
            PURSE_STAKING,
            PURSESTAKINGADDRESS,
            owner
        );
        const info = await purseStaking.userInfo(ownerAddress);
        console.log("User A: " + info);
        const info2 = await purseStaking.userInfo(userB)
        console.log("User B: " + info2);
        const info3 = await purseStaking.userInfo(userC)
        console.log("User C: " + info3);
        console.log();
        const rtA = await purseStaking.userReceiptToken(ownerAddress);
        console.log("User A Receipt Tokens: " + rtA);
        const rtB = await purseStaking.userReceiptToken(userB);
        console.log("User B Receipt Tokens: " + rtB);
        const rtC = await purseStaking.userReceiptToken(userC);
        console.log("User C Receipt Tokens: " + rtC);
        console.log();

        const availablePurseSupply = await purseStaking.availablePurseSupply();
        const totalReceiptSupply = await purseStaking.totalReceiptSupply();
        const totalLockedAmount = await purseStaking.totalLockedAmount();
        console.log("Total Available Purse: " + availablePurseSupply);
        console.log();
        console.log("Total receiptSupply: " + totalReceiptSupply);
        console.log();
        console.log("Total locked amount: " + totalLockedAmount);

        const balance = await token.balanceOf(PURSESTAKINGADDRESS)
        console.log("Staking Contract Balance: " + balance)
        console.log();

        //after upgrade
        //Rmb to change PURSE_STAKING to PurseStakingV3
        rewardDistributor = await hre.ethers.getContractAt(
            REWARD_DISTRIBUTOR,
            DISTRIBUTORADDRESS,
            owner
        );

        const CRPT = await purseStaking.cumulativeRewardPerToken();
        console.log("Staking Contract Cumulative Reward Per Token: " + CRPT);
        console.log();

        const lockPeriod = await purseStaking.lockPeriod();
        console.log("Staking Contract Lock Period: " + lockPeriod);
        console.log();

        const previewA = await purseStaking.previewClaimableRewards(
            ownerAddress
        );
        const previewB = await purseStaking.previewClaimableRewards(
            userB
        );
        const previewC = await purseStaking.previewClaimableRewards(
            userC
        );
        const distributeAmount = await rewardDistributor.previewDistribute();

        console.log("Preview Distribute Amount (Block rewards to add since last distribution): " + distributeAmount);
        console.log("Preview claimable on next action User A: " + previewA);
        console.log("Preview claimable on next action User B: " + previewB);
        console.log("Preview claimable on next action User C: " + previewC);
        console.log()

        const lastDistribution = await rewardDistributor.lastDistributionTime();
        const tokensPerInterval = await rewardDistributor.tokensPerInterval();
        console.log("Distributor Last Distribution Time: " + lastDistribution);
        console.log("Distributor Tokens Per Interval: " + tokensPerInterval);
        console.log()

        const distributorBalance = await token.balanceOf(DISTRIBUTORADDRESS);
        console.log("Distributor Balance: " + distributorBalance);
        const treasuryBalance = await token.balanceOf(TREASURYADDRESS);
        console.log("Treasury Balance: " + treasuryBalance);
        console.log();

        const vestingAddress = await purseStaking.vesting();
        console.log("Vesting Address: " + vestingAddress);
        console.log();
    })
})