const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("./BEP20.json");
require("dotenv").config();

//npx hardhat test test/Treasury.js --network bsctestnet
describe("Treasury Tests", function () {
    const PURSE_STAKING = "PurseStakingV3";
    const REWARD_DISTRIBUTOR = "RewardDistributor";
    const TREASURY = "Treasury";

    const PURSE = "0x57A6Db5E6D68419629dcE619314d9Fb37d2074b5";
    const PURSESTAKINGADDRESS = "0xCeF5fEbfC67ceB175560Dac99B05cDA951c10C26";
    const DISTRIBUTORADDRESS = "0xBB0c22EE5F2C3bD3B937bfD8753a352c0F8d8E1c";
    const TREASURYADDRESS = "0x3e4d07e72A8384F926930A6B49a4302B810fA788";

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let owner;
    let userB;
    let userC;
    let userRandom;
    let purse;
    let purseStaking;
    let rewardDistributor;
    let treasury;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        userB = signers[1];
        userC = signers[2];
        userRandom = signers[7];
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

        it("Non owner cannot call updatePurseStaking", async () => {
            await expect(
                treasury.connect(userB).updatePurseStaking(userB.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non owner cannot call updateDistributor", async () => {
            await expect(
                treasury.connect(userC).updateDistributor(userC.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non owner cannot call returnToken", async () => {
            await expect(
                treasury.connect(userB).returnToken(PURSE, userC.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non owner cannot call pause", async () => {
            await expect(
                treasury.connect(userC).pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Non owner cannot call unpause", async () => {
            const tx = await treasury.pause();
            await tx.wait();
            await expect(
                treasury.connect(userB).unpause()
            ).to.be.revertedWith("Ownable: caller is not the owner");
            const tx2 = await treasury.unpause();
        });
    });

    describe("Test updatePurseStaking", function () {
        it("Cannot update to zero address", async () => {
            await expect(
                treasury.updatePurseStaking(ZEROADDRESS)
            ).to.be.revertedWith("Treasury: zero address");
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await treasury.PURSE_STAKING();
            const tx1 = await treasury.updatePurseStaking(owner.address);
            await tx1.wait();
            const updatedAddress1 = await treasury.PURSE_STAKING();
            const tx2 = await treasury.updatePurseStaking(originalAddress);
            await tx2.wait();
            const updatedAddress2 = await treasury.PURSE_STAKING();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });

    describe("Test updateDistributor", function () {
        it("Cannot update to zero address", async () => {
            await expect(
                treasury.updateDistributor(ZEROADDRESS)
            ).to.be.revertedWith("Treasury: zero address");
        });

        it("Can update to a valid address", async () => {
            const originalAddress = await treasury.DISTRIBUTOR();
            const tx1 = await treasury.updateDistributor(owner.address);
            await tx1.wait();
            const updatedAddress1 = await treasury.DISTRIBUTOR();
            const tx2 = await treasury.updateDistributor(originalAddress);
            await tx2.wait();
            const updatedAddress2 = await treasury.DISTRIBUTOR();
            expect(updatedAddress1).not.equal(originalAddress);
            expect(updatedAddress2).equal(originalAddress);
        });
    });

    describe("Test returnToken", function () {
        it("Cannot pass a zero address", async () => {
            await expect(
                treasury.returnToken(
                    PURSE,
                    ZEROADDRESS,
                    ethers.parseEther("1")
                )
            ).to.be.revertedWith("Treasury: zero address");
        });

        it("Cannot pass a zero amount", async () => {
            await expect(
                treasury.returnToken(
                    PURSE,
                    owner.address,
                    ethers.parseEther("0")
                )
            ).to.be.revertedWith("Treasury: zero amount");
        });

        it("Cannot return more than balance", async () => {
            await expect(
                treasury.returnToken(
                    PURSE,
                    owner.address,
                    ethers.parseEther("100000000000")
                )
            ).to.be.revertedWith("Not enough balance");
        });

        it("Can return valid amount", async () => {
            const originalBalance = await purse.balanceOf(owner.address);
            const tx1 = await treasury.returnToken(
                PURSE,
                owner.address,
                ethers.parseEther("1")
            );
            await tx1.wait();
            const updatedBalance = await purse.balanceOf(owner.address);
            expect(updatedBalance).to.be.greaterThan(originalBalance);
            const tx3 = await purse.transfer(TREASURYADDRESS, ethers.parseEther("1"));
            await tx3.wait();
        });
    });

    describe("Test claimRewards", function () {
        it("Cannot pass a zero address", async () => {
            await expect(
                treasury.claimRewards(ZEROADDRESS)
            ).to.be.revertedWith("Treasury: zero address");
        });

        it("Cannot claim when paused", async () => {
            const tx1 = await treasury.pause();
            await tx1.wait();
            await expect(
                treasury.claimRewards(owner.address)
            ).to.be.revertedWith("Pausable: paused");
            const tx2 = await treasury.unpause();
            await tx2.wait();
        });

        it("User who did not stake have no available rewards", async () => {
            await expect(
                treasury.claimRewards(userRandom.address)
            ).to.be.revertedWith("PurseStakingV3: user does not have available rewards");
        });

        it("User who has staked before can claim available rewards", async () => {
            const initialBalance = await purse.balanceOf(userC.address);
            const initialPreview = await purseStaking.previewClaimableRewards(userC.address);
            const tx1 = await treasury.claimRewards(userC.address);
            await tx1.wait();
            const updatedBalance = await purse.balanceOf(userC.address);
            const updatedPreview = await purseStaking.previewClaimableRewards(userC.address);
            expect(updatedBalance).to.be.greaterThan(initialBalance);
            expect(updatedPreview).to.be.lessThan(initialPreview);
        });

        it("User who has unstaked some can claim rewards", async () => {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const userInfoInitial = await purseStaking.userInfo(owner.address);
            const claimableRewardsStructInitial = userInfoInitial[4];
            const initialBalance = await purse.balanceOf(owner.address);
            const initialPreview = await purseStaking.previewClaimableRewards(owner.address);

            const withdrawTx = await purseStaking.leave(
                ethers.parseEther("100000")
            );
            await withdrawTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfoUpdated = await purseStaking.userInfo(owner.address);
            const claimableRewardsStructUpdated = userInfoUpdated[4];
            const updatedPreview = await purseStaking.previewClaimableRewards(owner.address);
            expect(updatedPreview).to.be.greaterThan(initialPreview);
            expect(claimableRewardsStructUpdated).to.be.greaterThan(claimableRewardsStructInitial);

            const claimTx = await treasury.claimRewards(owner.address);
            await claimTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfoFinal = await purseStaking.userInfo(owner.address);
            const claimableRewardsStructFinal = userInfoFinal[4];
            const updatedBalance = await purse.balanceOf(owner.address);
            const finalPreview = await purseStaking.previewClaimableRewards(owner.address);
            expect(updatedBalance).to.be.greaterThan(initialBalance);
            expect(finalPreview).to.be.lessThan(initialPreview);
            expect(claimableRewardsStructFinal).to.equal(0);
        });

        it("User who stakes and then unstakes all can claim rewards", async () => {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const _purseStaking = await hre.ethers.getContractAt(
                PURSE_STAKING,
                PURSESTAKINGADDRESS,
                userB
            );
            const userInfo0 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct0 = userInfo0[4];
            const preview0 = await _purseStaking.previewClaimableRewards(userB.address);
            const initialBalance = await purse.balanceOf(userB.address);

            const stakeTx = await _purseStaking.enter(
                ethers.parseEther("1000000")
            );
            await stakeTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfo1 = await _purseStaking.userInfo(userB.address);
            const totalShares = await _purseStaking.userReceiptToken(userB.address);
            const claimableRewardsStruct1 = userInfo1[4];
            const preview1 = await _purseStaking.previewClaimableRewards(userB.address);
            console.log(claimableRewardsStruct0);
            console.log(claimableRewardsStruct1);
            expect(claimableRewardsStruct1).to.be.greaterThanOrEqual(claimableRewardsStruct0);
            expect(preview1).to.be.greaterThan(preview0);

            const withdrawTx = await _purseStaking.leave(
                totalShares
            );
            await withdrawTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfo2 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct2 = userInfo2[4];
            const preview2 = await _purseStaking.previewClaimableRewards(userB.address);
            expect(claimableRewardsStruct2).to.be.greaterThan(claimableRewardsStruct1);
            expect(preview2).to.be.greaterThan(preview1);

            const claimTx = await treasury.claimRewards(userB.address);
            await claimTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const finalBalance = await purse.balanceOf(userB.address);
            const userInfoFinal = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStructFinal = userInfoFinal[4];
            const previewFinal = await _purseStaking.previewClaimableRewards(userB.address);

            console.log(initialBalance);
            console.log(finalBalance);
            expect(finalBalance).to.be.greaterThan(initialBalance); //this line would expect to fail if its the very first time since the upgrade (0.01% difference)
            expect(previewFinal).to.be.lessThan(preview2);
            expect(claimableRewardsStructFinal).to.equal(0);
        });

        it("User that claimed after unstaking all will have no rewards to claim", async () => {
            const preview = await purseStaking.previewClaimableRewards(userB.address);
            expect(preview).to.equal(0);
            await expect(
                treasury.claimRewards(userB.address)
            ).to.be.revertedWith("PurseStakingV3: user does not have available rewards");
        });

        it("User who unstakes all should not have increasing rewards", async () => {
            const _purseStaking = await hre.ethers.getContractAt(
                PURSE_STAKING,
                PURSESTAKINGADDRESS,
                userB
            );
            const userInfo0 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct0 = userInfo0[4];
            const preview0 = await _purseStaking.previewClaimableRewards(userB.address);

            const stakeTx = await _purseStaking.enter(
                ethers.parseEther("1000000")
            );
            await stakeTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfo1 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct1 = userInfo1[4];
            const preview1 = await _purseStaking.previewClaimableRewards(userB.address);
            console.log(claimableRewardsStruct0);
            console.log(claimableRewardsStruct1);
            expect(claimableRewardsStruct1).to.be.greaterThanOrEqual(claimableRewardsStruct0);
            expect(preview1).to.be.greaterThan(preview0);

            const totalShares = await _purseStaking.userReceiptToken(userB.address);
            const withdrawTx = await _purseStaking.leave(
                totalShares
            );
            await withdrawTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userInfo2 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct2 = userInfo2[4];
            const preview2 = await _purseStaking.previewClaimableRewards(userB.address);
            expect(claimableRewardsStruct2).to.be.greaterThan(claimableRewardsStruct1);
            expect(preview2).to.be.greaterThan(preview1);

            const userInfo3 = await _purseStaking.userInfo(userB.address);
            const claimableRewardsStruct3 = userInfo3[4];
            const preview3 = await _purseStaking.previewClaimableRewards(userB.address);
            expect(claimableRewardsStruct3).to.equal(claimableRewardsStruct2);
            expect(preview3).to.equal(preview2);

            //owner stakes
            const anotherUserStakes = await purseStaking.enter(
                ethers.parseEther("1000000")
            );
            await anotherUserStakes.wait();

            const userInfo4 = await purseStaking.userInfo(userB.address);
            const claimableRewardsStruct4 = userInfo4[4];
            const preview4 = await purseStaking.previewClaimableRewards(userB.address);
            expect(claimableRewardsStruct4).to.equal(claimableRewardsStruct3);
            expect(preview4).to.equal(preview3);
        });
    });
})