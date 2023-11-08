const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("./BEP20.json");
require("dotenv").config();

//npx hardhat test test/RewardDistributor.js --network bsctestnet
describe("Reward Distributor Tests", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0x5E329512a3a4Cf8aBc1a82Be60c7af180a4B68B7";
    const PURSESTAKINGADDRESS = "0x31F967CaA09f527170a0071080d02F2fc8881611";
    const DISTRIBUTORADDRESS = "0x6ec569858Bbb89A3278EdE38F610da7C3B463b5E";
    const TREASURYADDRESS = "0xb643dF48cDe7456c19B4a8273E73564215ba9aBf";

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
                    ethers.parseEther("5")
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