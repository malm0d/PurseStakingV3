const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("../BEP20.json");
require("dotenv").config();

//npx hardhat test test/staking/PurseStakingV3.js --network bsctestnet
describe("Treasury Tests", function () {
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

    describe("Check access for V3 functions", function () {
        it("Non reward distributor cannot call updateRewards", async () => {
            await expect(
                purseStaking.updateRewards()
            ).to.be.revertedWith("PurseStakingV3: msg.sender is not the distributor");
        });

        it("Non owner cannot call updateDistributor", async () => {
            await expect(
                purseStaking.connect(userB).updateDistributor(userC.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non owner cannot call updateTreasury", async () => {
            await expect(
                purseStaking.connect(userC).updateTreasury(userB.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Test updateDistributor", function () {
        it("Cannot update to a zero address", async () => {
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await purseStaking.distributor();
            const tx1 = await purseStaking.updateDistributor(owner.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress1 = await purseStaking.distributor();
            const tx2 = await purseStaking.updateDistributor(originalAddress);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress2 = await purseStaking.distributor();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });

    describe("Test updateTreasury", function () {
        it("Cannot update to a zero address", async () => {
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await purseStaking.treasury();
            const tx1 = await purseStaking.updateTreasury(owner.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress1 = await purseStaking.treasury();
            const tx2 = await purseStaking.updateTreasury(originalAddress);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress2 = await purseStaking.treasury();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });

    describe("Test recoverToken", function () {
        it("Recipient cannot be a zero address", async () => {
            await expect(
                purseStaking.recoverToken(
                    PURSE,
                    ethers.parseEther("1"),
                    ZEROADDRESS
                )
            ).to.be.revertedWith("Send to Zero Address");
        });

        it("Cannot return more than balance", async () => {
            await expect(
                purseStaking.recoverToken(
                    PURSE,
                    ethers.parseEther("10000000000"),
                    owner.address
                )
            ).to.be.revertedWith("Not enough balance");
        });

        it("Can return a valid amount", async () => {
            const intialBalance = await purse.balanceOf(owner.address);
            const tx = await purseStaking.recoverToken(
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

    describe("Test updateClaim", function () {
        it("Non treasury address cannot call", async () => {
            await expect(
                purseStaking.updateClaim(owner.address)
            ).to.be.revertedWith("PurseStakingV3: msg.sender is not the treasury");
            await expect(
                purseStaking.connect(userB).updateClaim(userB.address)
            ).to.be.revertedWith("PurseStakingV3: msg.sender is not the treasury");
        });
    });
})