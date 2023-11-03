const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("./BEP20.json");
require("dotenv").config();

//npx hardhat test test/test.js --network bsctestnet
describe("Test", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0xBbF6544495A2b7F4A1f2605826fEbb414AD5A019";
    const PURSESTAKINGADDRESS = "0x7358DB4D2C2A849DF81274CFF8DBEFBa8385b486";
    const DISTRIBUTORADDRESS = "0x38a892a8a65539250Ec971c48539cDFb8D4922da";
    const TREASURYADDRESS = "0x99a5E8f9DBb63f8492cb4C5650074E3399e85F8c";

    let owner;
    const userB = "0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966";
    const userC = "0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D";

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
    });

    it("PurseStaking", async () => {

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
        const info = await purseStaking.userInfo(owner.address);
        console.log("User A: " + info);
        const info2 = await purseStaking.userInfo(userB)
        console.log("User B: " + info2);
        const info3 = await purseStaking.userInfo(userC)
        console.log("User C: " + info3);

        const rtA = await purseStaking.userReceiptToken(owner.address);
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
        const previewA = await purseStaking.previewClaimableRewards(
            owner.address
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
    })
})