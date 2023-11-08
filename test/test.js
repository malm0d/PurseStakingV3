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

    const PURSE = "0x5E329512a3a4Cf8aBc1a82Be60c7af180a4B68B7";
    const PURSESTAKINGADDRESS = "0x31F967CaA09f527170a0071080d02F2fc8881611";
    const DISTRIBUTORADDRESS = "0x6ec569858Bbb89A3278EdE38F610da7C3B463b5E";
    const TREASURYADDRESS = "0xb643dF48cDe7456c19B4a8273E73564215ba9aBf";

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