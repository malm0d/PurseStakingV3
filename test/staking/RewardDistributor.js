const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("../BEP20.json");
require("dotenv").config();

//npx hardhat test test/staking/RewardDistributor.js --network bsctestnet
describe("Reward Distributor Tests", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKINGADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const DISTRIBUTORADDRESS = "0xdb307306ae74EefaCf26afdca25C5A11D5b7e09e";
    const TREASURYADDRESS = "0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB";

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let owner;
    let userB;
    let userC;
    let purse;
    let purseStaking;
    let rewardDistributor;
    let treasury;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        userB = signers[1];
        userC = signers[2];
        purse = await hre.ethers.getContractAt(
            BEP20ABI,
            PURSE,
            owner
        );
        purseStaking = await hre.ethers.getContractAt(
            PURSE_STAKING,
            PURSESTAKINGADDRESS,
            owner
        );
        rewardDistributor = await hre.ethers.getContractAt(
            REWARD_DISTRIBUTOR,
            DISTRIBUTORADDRESS,
            owner
        );
        treasury = await hre.ethers.getContractAt(
            TREASURY,
            TREASURYADDRESS,
            owner
        );
    });

    describe("Check access for functions", function () {

        it("Non reward tracker cannot call distribute", async () => {
            await expect(
                rewardDistributor.distribute()
            ).to.be.revertedWith("RewardDistributor: msg.sender is not the rewardTracker")
            await expect(
                rewardDistributor.connect(userB).distribute()
            ).to.be.revertedWith("RewardDistributor: msg.sender is not the rewardTracker")
        });

        it("Non governor cannot call updateLastDistributionTime", async () => {
            await expect(
                rewardDistributor.connect(userB).updateLastDistributionTime()
            ).to.be.reverted;
        });

        it("Non governor cannot call setTokensPerInterval", async () => {
            await expect(
                rewardDistributor.connect(userC).setTokensPerInterval(
                    ethers.parseEther("1")
                )
            ).to.be.reverted;
        });

        it("Non owner cannot call recoverToken", async () => {
            await expect(
                rewardDistributor.connect(userC).recoverToken(
                    PURSE,
                    ethers.parseEther("1"),
                    userB.address
                )
            ).to.be.reverted;
        });

        it("Non owner cannot call updateTreasury", async () => {
            await expect(
                rewardDistributor.connect(userB).updateTreasury(userC.address)
            ).to.be.reverted;
        });

        it("Non owner cannot call updateRewardTracker", async () => {
            await expect(
                rewardDistributor.connect(userC).updateRewardTracker(userC.address)
            ).to.be.reverted;
        });
    });

    describe("Test updateLastDistributionTime", function () {
        it("Governor can call updateLastDistributionTime", async () => {
            //owner has been set as the governor
            const initalTime = await rewardDistributor.lastDistributionTime();
            const tx = await rewardDistributor.updateLastDistributionTime();
            await tx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const finalTime = await rewardDistributor.lastDistributionTime();
            expect(finalTime).to.be.gt(initalTime);
        });
    });

    describe("Test setTokensPerInterval", function () {
        it("Governer can call setTokensPerInterval, staking contract should update storage value",
            async () => {
                const initialCRPTValue = await purseStaking.cumulativeRewardPerToken();
                const initialTokensPerInterval = await rewardDistributor.tokensPerInterval();
                const tx1 = await rewardDistributor.setTokensPerInterval(
                    ethers.parseEther("10")
                );
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                const finalCRPTValue = await purseStaking.cumulativeRewardPerToken();
                const finalTokensPerInterval = await rewardDistributor.tokensPerInterval();
                expect(finalCRPTValue).to.be.gt(initialCRPTValue);
                expect(finalTokensPerInterval).not.equal(initialTokensPerInterval);
                const tx2 = await rewardDistributor.setTokensPerInterval(
                    ethers.parseEther("7")
                );
                await tx2.wait();
            });
    });

    describe("Test recoverToken", function () {
        it("Recipient cannot be a zero address", async () => {
            await expect(
                rewardDistributor.recoverToken(
                    PURSE,
                    ethers.parseEther("1"),
                    ZEROADDRESS
                )
            ).to.be.revertedWith("RewardDistributor: Send to Zero Address");
        });

        it("Cannot return more than balance", async () => {
            await expect(
                rewardDistributor.recoverToken(
                    PURSE,
                    ethers.parseEther("10000000000"),
                    owner.address
                )
            ).to.be.revertedWith("Not enough balance");
        });

        it("Can return a valid amount", async () => {
            const intialBalance = await purse.balanceOf(owner.address);
            const tx = await rewardDistributor.recoverToken(
                PURSE,
                ethers.parseEther("10"),
                owner.address
            );
            await tx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const finalBalance = await purse.balanceOf(owner.address);
            expect(finalBalance).to.be.gt(intialBalance);
        });
    });

    describe("Test updateTreasury", function () {
        it("Cannot update to a zero address", async () => {
            await expect(
                rewardDistributor.updateTreasury(ZEROADDRESS)
            ).to.be.revertedWith("RewardDistributor: Zero Address");
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await rewardDistributor.treasury();
            const tx1 = await rewardDistributor.updateTreasury(owner.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress1 = await rewardDistributor.treasury();
            const tx2 = await rewardDistributor.updateTreasury(originalAddress);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress2 = await rewardDistributor.treasury();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });

    describe("Test updateRewardTracker", function () {
        it("Cannot update to a zero address", async () => {
            await expect(
                rewardDistributor.updateRewardTracker(ZEROADDRESS)
            ).to.be.revertedWith("RewardDistributor: Zero Address");
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await rewardDistributor.rewardTracker();
            const tx1 = await rewardDistributor.updateRewardTracker(owner.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress1 = await rewardDistributor.rewardTracker();
            const tx2 = await rewardDistributor.updateRewardTracker(originalAddress);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress2 = await rewardDistributor.rewardTracker();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });
})