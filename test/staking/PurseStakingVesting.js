const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
require("dotenv").config();
const helpers = require("@nomicfoundation/hardhat-network-helpers");

//Tests for PurseStakingV3 contract.

//Testnet: npx hardhat test test/staking/PurseStakingVesting.js --network bsctestnet
//Forked: npx hardhat test test/staking/PurseStakingVesting.js --network hardhat

//IMPT: "Functionality" tests will be done on a forked bsc testnet, so DO NOT run it together
//with the other tests: "Pre-conditions", "Access control", "Update contract addresses".
describe("PurseStakingVesting Tests", function () {
    const PURSE_STAKING = "PurseStakingV3v";
    const PURSE_STAKING_VESTING = "PurseStakingVesting";

    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKING_ADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const PURSESTAKINGVESTING_ADDRESS = "0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053";

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let owner;
    let userB;
    let userC;

    let purse;
    let purseStaking;
    let vesting;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        userB = signers[1];
        userC = signers[2];

        purse = await hre.ethers.getContractAt(
            PURSE_BSC_ABI,
            PURSE_ADDRESS,
            owner
        );

        purseStaking = await hre.ethers.getContractAt(
            PURSE_STAKING,
            PURSESTAKING_ADDRESS,
            owner
        );

        vesting = await hre.ethers.getContractAt(
            PURSE_STAKING_VESTING,
            PURSESTAKINGVESTING_ADDRESS,
            owner
        );
    });

    describe("Pre-conditions:", function () {
        it("PurseStakingVesting has the correct Purse Staking address", async () => {
            const purseStakingAddress = await vesting.getPurseStaking();
            assert.equal(purseStakingAddress, PURSESTAKING_ADDRESS);
        });
    });

    describe("Access control:", function () {
        it("lockWithEndTime cannot be called by non PurseStaking", async () => {
            await expect(
                vesting.connect(owner).lockWithEndTime(owner.address, 100, 100)
            ).to.be.revertedWith("Only PurseStaking can call");
        });

        it("updatePurseStaking cannot be called by non owner", async () => {
            await expect(
                vesting.connect(userB).updatePurseStaking(userB.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("recoverToken cannot be called by non owner", async () => {
            await expect(
                vesting.connect(userC).recoverToken(PURSE_ADDRESS, 100, userC.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Update contract addresses:", function () {
        it("updatePurseStaking updates purseStaking variable correctly", async () => {
            const tx1 = await vesting.updatePurseStaking(userC.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const purseStakingAddress1 = await vesting.getPurseStaking();
            expect(purseStakingAddress1).to.equal(userC.address);
            const tx2 = await vesting.updatePurseStaking(PURSESTAKING_ADDRESS);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const purseStakingAddress2 = await vesting.getPurseStaking();
            expect(purseStakingAddress2).to.equal(PURSESTAKING_ADDRESS);
        });
    });

    //Note: Functionality tests will be done on a forked bsc testnet.
    //IMPT: the state of the forked testnet resets to the initialized state after each test run,
    //though with increasing block number (and timestamp) to mimic the actual testnet.
    //IT DOES NOT CARRY FORWARD THE CONTRACT STATE BETWEEN RUNS.
    describe("Functionality:", function () {
        it("Calling leave in PurseStaking should update contract balances correctly and create a vesting schedule", async () => {
            const purseStakingBalanceBefore = await purse.balanceOf(PURSESTAKING_ADDRESS);
            const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
            const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);

            const leaveAmount = BigInt(1000 * 10 ** 18)
            const leave = await purseStaking.connect(owner).leave(leaveAmount);
            await leave.wait();

            const purseStakingBalanceAfter = await purse.balanceOf(PURSESTAKING_ADDRESS);
            const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
            const numSchedulesAfter = await vesting.numVestingSchedules(owner.address);

            expect(purseStakingBalanceAfter).to.be.lt(purseStakingBalanceBefore);
            expect(vestingBalanceAfter).to.be.gte(vestingBalanceBefore + leaveAmount);
            expect(numSchedulesAfter).to.equal(numSchedulesBefore + BigInt(1));
        });

        it("Calling leave in PurseStaking should update contract balances correctly and create a second vesting schedule", async () => {
            await helpers.time.increase(864000); //Forward time by 10 days (864000 seconds)

            const purseStakingBalanceBefore = await purse.balanceOf(PURSESTAKING_ADDRESS);
            const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
            const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);

            const leaveAmount = BigInt(2000 * 10 ** 18)
            const leave = await purseStaking.connect(owner).leave(leaveAmount);
            await leave.wait();

            const purseStakingBalanceAfter = await purse.balanceOf(PURSESTAKING_ADDRESS);
            const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
            const numSchedulesAfter = await vesting.numVestingSchedules(owner.address);

            expect(purseStakingBalanceAfter).to.be.lt(purseStakingBalanceBefore);
            expect(vestingBalanceAfter).to.be.gte(vestingBalanceBefore + leaveAmount);
            expect(numSchedulesAfter).to.equal(numSchedulesBefore + BigInt(1));
        });

        it("vestCompletedSchedules should complete one vesting schedule: " +
            "numVestingSchedules, escrowed, vested, purse balances, should adjust correctly",
            async () => {
                //Get first vesting schedule and its values
                const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(owner.address, 0);
                const vestingStartTime = vestingSchedule1[0];
                const vestingEndTime = vestingSchedule1[1];
                const vestingAmount = vestingSchedule1[2];

                //Get other values expected to change after complete vesting a schedule
                const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceBefore = await vesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await vesting.accountVestedBalance(owner.address);
                const userBalanceBefore = await purse.balanceOf(owner.address);
                const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);

                //Forward the time first schedule's endTime
                // await helpers.time.increaseTo(Number(vestingEndTime));\
                //Since in the previous test, we forwarded past the lock time of the first schedule, 
                //we dont need to forward again

                //Vest ONE completed schedule
                const tx1 = await vesting.connect(owner).vestCompletedSchedules();
                await tx1.wait();

                //Number of schedules should decrease by 1
                const numScheduleAfter = await vesting.numVestingSchedules(owner.address);
                expect(numScheduleAfter).to.equal(numSchedulesBefore - BigInt(1));

                //AccountEscrowedBalance should be reduced
                const accountEscrowedBalanceAfter = await vesting.accountEscrowedBalance(owner.address);
                expect(accountEscrowedBalanceAfter).to.equal(accountEscrowedBalanceBefore - vestingAmount);

                //AccountVestedBalance should be increased
                const accountVestedBalanceAfter = await vesting.accountVestedBalance(owner.address);
                expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore + vestingAmount);

                //User PURSE balance should increase
                const userBalanceAfter = await purse.balanceOf(owner.address);
                expect(userBalanceAfter).to.equal(userBalanceBefore + vestingAmount);

                //Vesting contract balance should reduce
                const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
                expect(vestingBalanceAfter).to.equal(vestingBalanceBefore - vestingAmount);
            }
        );

        it("vestCompletedSchedules should complete all vesting schedules: " +
            "numVestingSchedules, escrowed, vested, purse balances, should adjust correctly",
            async () => {
                const leaveTx = await purseStaking.connect(owner).leave(BigInt(3000 * 10 ** 18));
                await leaveTx.wait();
                //--------------------------------------------------------------------------------

                //Confirm that multiple vesting schedules exist
                const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);
                expect(numSchedulesBefore).to.be.gt(BigInt(1));

                //Get first vesting schedule
                const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(owner.address, 0);
                const vestingStartTime1 = vestingSchedule1[0];
                const vestingEndTime1 = vestingSchedule1[1];
                const vestingAmount1 = vestingSchedule1[2];

                //Get second vesting schedule
                const vestingSchedule2 = await vesting.getVestingScheduleAtIndex(owner.address, 1);
                const vestingStartTime2 = vestingSchedule2[0];
                const vestingEndTime2 = vestingSchedule2[1];
                const vestingAmount2 = vestingSchedule2[2];

                //Get other values expected to change after complete vesting a schedule
                const accountEscrowedBalanceBefore = await vesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await vesting.accountVestedBalance(owner.address);
                const userBalanceBefore = await purse.balanceOf(owner.address);
                const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);

                //Forward time to the endTime of the second vesting schedule so that both schedules
                //can be vested
                await helpers.time.increaseTo(Number(vestingEndTime2));

                //Vest all completed schedules
                const vestTx = await vesting.connect(owner).vestCompletedSchedules();
                await vestTx.wait();

                //Number of schedules should decrease to 0
                const numScheduleAfter = await vesting.numVestingSchedules(owner.address);
                expect(numScheduleAfter).not.equal(numSchedulesBefore);
                expect(numScheduleAfter).to.equal(BigInt(0));

                //AccountEscrowedBalance should be reduced
                const accountEscrowedBalanceAfter = await vesting.accountEscrowedBalance(owner.address);
                expect(accountEscrowedBalanceAfter).to.be.lt(accountEscrowedBalanceBefore);
                expect(accountEscrowedBalanceAfter).to.equal(
                    accountEscrowedBalanceBefore - vestingAmount1 - vestingAmount2
                );

                //AccountVestedBalance should be increased
                const accountVestedBalanceAfter = await vesting.accountVestedBalance(owner.address);
                expect(accountVestedBalanceAfter).to.be.gt(accountVestedBalanceBefore);
                expect(accountVestedBalanceAfter).to.equal(
                    accountVestedBalanceBefore + vestingAmount1 + vestingAmount2
                );

                //User PURSE balance should increase
                const userBalanceAfter = await purse.balanceOf(owner.address);
                expect(userBalanceAfter).to.be.gt(userBalanceBefore);
                expect(userBalanceAfter).to.equal(userBalanceBefore + vestingAmount1 + vestingAmount2);

                //Vesting contract balance should reduce
                const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
                expect(vestingBalanceAfter).to.be.lt(vestingBalanceBefore);
                expect(vestingBalanceAfter).to.equal(vestingBalanceBefore - vestingAmount1 - vestingAmount2);
            }
        );

        it("vestCompletedSchedules should revert when there are no schedules to vest", async () => {
            const lockPeriod = await purseStaking.lockPeriod();
            const leave1 = await purseStaking.connect(owner).leave(BigInt(1000 * 10 ** 18));
            await leave1.wait();
            await helpers.time.increase(Number(lockPeriod) / 2);
            const leave2 = await purseStaking.connect(owner).leave(BigInt(1500 * 10 ** 18));
            await leave2.wait();

            //Confirm there are multiple vesting schedules
            const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);
            expect(numSchedulesBefore).to.be.gt(BigInt(1));

            //Vesting should revert since none of the schdules have reached their endTime
            await expect(
                vesting.connect(owner).vestCompletedSchedules()
            ).to.be.revertedWith("No tokens to vest");
        });

        it("vestCompletedSchedules should revert when a second schedule is not completed yet", async () => {
            const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(owner.address, 0);
            const vestingEndTime1 = vestingSchedule1[1];
            const vestingAmount1 = vestingSchedule1[2];

            //Forward time to vest the first schedule only
            await helpers.time.increaseTo(vestingEndTime1);

            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);

            //Vest completed schedule
            const vestTx = await vesting.connect(owner).vestCompletedSchedules();
            await vestTx.wait();

            //User PURSE balance should increase by the correct schedule amount
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);
            expect(userPurseBalanceAfter).to.equal(userPurseBalanceBefore + vestingAmount1);
            expect(vestingBalanceAfter).to.equal(vestingBalanceBefore - vestingAmount1);

            //There should be one schedule remaining
            const numScheduleAfter = await vesting.numVestingSchedules(owner.address);
            expect(numScheduleAfter).to.equal(BigInt(1));

            //Vesting the remaining schedule should revert since its endTime has not been reached
            await expect(
                vesting.connect(owner).vestCompletedSchedules()
            ).to.be.revertedWith("No tokens to vest");
        });

        it("recoverToken should recover the correct amount of tokens", async () => {
            const userBalanceBefore = await purse.balanceOf(owner.address);
            const vestingBalanceBefore = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);

            const tx = await purse.connect(owner).transfer(PURSESTAKINGVESTING_ADDRESS, BigInt(10));
            await tx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const recoverTx = await vesting.connect(owner).recoverToken(PURSE_ADDRESS, BigInt(10), owner.address);
            await recoverTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const userBalanceAfter = await purse.balanceOf(owner.address);
            const vestingBalanceAfter = await purse.balanceOf(PURSESTAKINGVESTING_ADDRESS);

            expect(userBalanceAfter).to.equal(userBalanceBefore);
            expect(vestingBalanceAfter).to.equal(vestingBalanceBefore);
        });
    });

});