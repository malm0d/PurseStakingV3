const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("../../abis/BEP20.json");
require("dotenv").config();

//npx hardhat test test/staking/StatusMainnet.js --network bscmainnet
describe("Test", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C";
    const PURSESTAKINGADDRESS = "0xFb1D31a3f51Fb9422c187492D8EA14921d6ea6aE";
    const DISTRIBUTORADDRESS = "0x1b6d1D232c35F3534EDeB9A989DB62831Ff87A40";
    const TREASURYADDRESS = "0x6935a78b5ff92435662FB365085e5E490cC032C5";

    let owner;
    let userB;
    let userC;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        // owner = signers[0];
        // userB = signers[1].address;
        // userC = signers[2].address;
        owner = signers[0];
        userB = "0x84BA3875bdBD2BccdD3cbac2eF242E8013E595c9";
        userC = "0x125fBfc0880dd04EeD2ce373fdE077788d8dA1Ec";
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
        const info = await purseStaking.userInfo(owner.address);
        console.log("User A: " + info);
        const info2 = await purseStaking.userInfo(userB)
        console.log("User B: " + info2);
        const info3 = await purseStaking.userInfo(userC)
        console.log("User C: " + info3);
        console.log();
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

        const lockPeriod = await purseStaking.lockPeriod();
        console.log("Staking Contract Lock Period: " + lockPeriod);
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

        const vestingAddress = await purseStaking.vesting();
        console.log("Vesting Address: " + vestingAddress);
        console.log();
    })
})