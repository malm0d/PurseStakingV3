const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("./BEP20.json");
require("dotenv").config();

//npx hardhat test test/test.js --network bsctestnet
describe("Test", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const PURSESTAKINGADDRESS = "0x1e4Dc34f66Be83D863006086128B7259cf3AD0eD";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const DISTRIBUTORADDRESS = "0x95e71f6C7d8D3b32bd697A88dD6C37346130e67F";
    const TREASURY = "Treasury";
    const TREASURYADDRESS = "0x49e5eE0aF3Abf26f02c3107B99fc849acc40C3dF";
    let owner;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
    });

    it("PurseStakingV2", async () => {

        token = await hre.ethers.getContractAt(
            BEP20ABI,
            "0xE81165fCDD0336A0f219cF8235D6287Bd0f9f752",
            owner
        );

        rewardDistributor = await hre.ethers.getContractAt(
            REWARD_DISTRIBUTOR,
            DISTRIBUTORADDRESS,
            owner
        );

        purseStaking = await hre.ethers.getContractAt(
            PURSE_STAKING,
            PURSESTAKINGADDRESS,
            owner
        );
        const info = await purseStaking.userInfo(owner.address);
        console.log("User A: " + info);
        const info2 = await purseStaking.userInfo("0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966")
        console.log("User B: " + info2);
        const info3 = await purseStaking.userInfo("0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D")
        console.log("User C: " + info3);

        const rtA = await purseStaking.userReceiptToken(owner.address);
        console.log("User A Receipt Tokens: " + rtA);
        const rtB = await purseStaking.userReceiptToken("0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966");
        console.log("User B Receipt Tokens: " + rtB);
        const rtC = await purseStaking.userReceiptToken("0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D");
        console.log("User C Receipt Tokens: " + rtC);


        const availablePurseSupply = await purseStaking.availablePurseSupply();
        const totalReceiptSupply = await purseStaking.totalReceiptSupply();
        const totalLockedAmount = await purseStaking.totalLockedAmount();
        console.log("Total Available Purse: " + availablePurseSupply)
        console.log("Total receiptSupply: " + totalReceiptSupply)
        console.log("Total locked amount: " + totalLockedAmount);

        const balance = await token.balanceOf(PURSESTAKINGADDRESS)
        console.log("Contract Balance: " + balance)

        const CRPT = await purseStaking.cumulativeRewardPerToken();
        console.log("Contract Cumulative Reward Per Token: " + CRPT);
        const previewA = await purseStaking.previewClaimableRewards(
            owner.address
        );
        const previewB = await purseStaking.previewClaimableRewards(
            "0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966"
        );
        const previewC = await purseStaking.previewClaimableRewards(
            "0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D"
        );

        console.log("Preview claimable User A: " + previewA);
        console.log("Preview claimable User B: " + previewB);
        console.log("Preview claimable User C: " + previewC);

        const lastDistribution = await rewardDistributor.lastDistributionTime();
        const tokensPerInterval = await rewardDistributor.tokensPerInterval();
        console.log("Distributor Last Distribution: " + lastDistribution);
        console.log("Distributor Tokens Per Interval: " + tokensPerInterval + " (10 PURSE)");

        const distributorBalance = await token.balanceOf(DISTRIBUTORADDRESS);
        console.log("Distributor Balance: " + distributorBalance);
        const treasuryBalance = await token.balanceOf(TREASURYADDRESS);
        console.log("Treasury Balance: " + treasuryBalance);
        const stakingBalance = await token.balanceOf(PURSESTAKINGADDRESS);
        console.log("Staking balance: " + stakingBalance)

        const distributeAmount = await rewardDistributor.previewDistribute();
        console.log("Distribute Amount: " + distributeAmount);

        const cumulative = await purseStaking.getCumulativeRewardPerToken(
            "0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D"
        );
        console.log("Cumulative: " + cumulative);
    })
})