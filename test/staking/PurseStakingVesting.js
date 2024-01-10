const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
require("dotenv").config();
const helpers = require("@nomicfoundation/hardhat-network-helpers");

//Tests for PurseStakingV3 vesting logic.

//Testnet: npx hardhat test test/staking/PurseStakingVesting.js --network bsctestnet
//Forked: npx hardhat test test/staking/PurseStakingVesting.js --network hardhat

//IMPT: "Functionality" tests will be done on a forked bsc testnet, so DO NOT run it together
//with the other tests: "Pre-conditions", "Access control", "Update contract addresses".
describe("PurseStakingV3 Vesting Tests", function () {
    const PURSE_STAKING = "PurseStakingV3v";
    const PURSE_STAKING_VESTING = "PurseStakingVesting";

    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKING_ADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const PURSESTAKINGVESTING_ADDRESS = "0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053";
    const LOCKPERIOD = BigInt("1814400")
    const LOCKPERIOD_SECONDS = 1814400;

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

        //At this point, there should be vesting schedules in the vesting contract, otherwise
        //the tests will fail. Go back to PurseStakingV3v and call `enter` and `leave` to create
        //vesting schedules.
        it("vestCompletedSchedules should complete one vesting schedule: " +
            "numVestingSchedules, escrowed, vested, purse balances, total locked amount " +
            "should adjust correctly",
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
                const purseStakingBalanceBefore = await purse.balanceOf(PURSESTAKING_ADDRESS);
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Forward the time by 21 days (1814400 seconds)
                await helpers.time.increaseTo(Number(vestingStartTime) + LOCKPERIOD_SECONDS);

                //Vest ONE completed schedule
                const tx1 = await vesting.connect(owner).vestCompletedSchedules();
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                //Number of schedules should decrease by 1 (from 2 to 1), since only one schedule
                //acheived its endTime
                const numScheduleAfter = await vesting.numVestingSchedules(owner.address);
                expect(numScheduleAfter).to.equal(BigInt(1));
                expect(numScheduleAfter).to.equal(numSchedulesBefore - BigInt(1));

                //AccountEscrowedBalance should be reduced
                const accountEscrowedBalanceAfter = await vesting.accountEscrowedBalance(owner.address);
                expect(accountEscrowedBalanceAfter).to.equal(accountEscrowedBalanceBefore - vestingAmount);

                //AccountVestedBalance should be increased
                const accountVestedBalanceAfter = await vesting.accountVestedBalance(owner.address);
                expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore + vestingAmount);

                //User PURSE balance should increase, and PurseStaking PURSE balance should decrease
                const userBalanceAfter = await purse.balanceOf(owner.address);
                const purseStakingBalanceAfter = await purse.balanceOf(PURSESTAKING_ADDRESS);
                expect(userBalanceAfter).to.equal(userBalanceBefore + vestingAmount);
                expect(purseStakingBalanceAfter).to.equal(purseStakingBalanceBefore - vestingAmount);

                //Total locked amount in PurseStaking should decrease
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.equal(totalLockedAmountBefore - vestingAmount);
            }
        );

        it("vestCompletedSchedules should complete all vesting schedules: " +
            "numVestingSchedules, escrowed, vested, purse balances, total locked amount " +
            "should adjust correctly",
            async () => {
                //Enter and leave PurseStaking to create another vesting schedule.
                //(DO NOT include this `enter` & `leave` block if doing separate test runs between
                //each test case, as the state of the forked testnet does not carry forward from 
                //the previous test case if the test run is stopped)
                //--------------------------------------------------------------------------------
                const enterTx = await purseStaking.connect(owner).enter(BigInt(2000000 * 10 ** 18));
                await enterTx.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));
                const leaveTx = await purseStaking.connect(owner).leave(BigInt(2000000 * 10 ** 18));
                await leaveTx.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));
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
                const purseStakingBalanceBefore = await purse.balanceOf(PURSESTAKING_ADDRESS);
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Forward time to the endTime of the second vesting schedule so that both schedules
                //can be vested
                await helpers.time.increaseTo(Number(vestingStartTime2) + LOCKPERIOD_SECONDS);

                //Vest all completed schedules
                const vestTx = await vesting.connect(owner).vestCompletedSchedules();
                await vestTx.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

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

                //User PURSE balance should increase, and PurseStaking PURSE balance should decrease
                const userBalanceAfter = await purse.balanceOf(owner.address);
                const purseStakingBalanceAfter = await purse.balanceOf(PURSESTAKING_ADDRESS);
                expect(userBalanceAfter).to.be.gt(userBalanceBefore);
                expect(userBalanceAfter).to.equal(userBalanceBefore + vestingAmount1 + vestingAmount2);
                expect(purseStakingBalanceAfter).to.be.lt(purseStakingBalanceBefore);
                expect(purseStakingBalanceAfter).to.equal(
                    purseStakingBalanceBefore - vestingAmount1 - vestingAmount2
                );

                //Total locked amount in PurseStaking should decrease
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.be.lt(totalLockedAmountBefore);
                expect(totalLockedAmountAfter).to.equal(
                    totalLockedAmountBefore - vestingAmount1 - vestingAmount2
                );
            }
        );

        it("vestCompletedSchedules should revert when a second schedule is not completed yet", async () => {
            //(DO NOT include this `enter` & `leave` block if doing separate test runs between
            //each test case, as the state of the forked testnet does not carry forward from 
            //the previous test case if the test run is stopped)
            //--------------------------------------------------------------------------------
            const enterTx1 = await purseStaking.connect(owner).enter(BigInt(2000000 * 10 ** 18));
            await enterTx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const leaveTx1 = await purseStaking.connect(owner).leave(BigInt(2000000 * 10 ** 18));
            await leaveTx1.wait();

            //Forward time by 10 days (864000 seconds) so vesting schedules have very different endTimes
            await helpers.time.increase(864000);

            await new Promise(resolve => setTimeout(resolve, 5000));
            const enterTx2 = await purseStaking.connect(owner).enter(BigInt(1000000 * 10 ** 18));
            await enterTx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const leaveTx2 = await purseStaking.connect(owner).leave(BigInt(1000000 * 10 ** 18));
            await leaveTx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            //--------------------------------------------------------------------------------

            //Confirm that multiple vesting schedules exist
            const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);
            expect(numSchedulesBefore).to.be.gt(BigInt(1));

            const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(owner.address, 0);
            const vestingEndTime1 = vestingSchedule1[1];

            //Forward time to vest the first schedule only
            await helpers.time.increaseTo(vestingEndTime1);

            //Vest completed schedule
            const vestTx = await vesting.connect(owner).vestCompletedSchedules();
            await vestTx.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));

            //There should be at least one schedule remaining
            const numScheduleAfter = await vesting.numVestingSchedules(owner.address);
            expect(numScheduleAfter).to.be.gt(BigInt(0));

            //Vesting the remaining schedule should revert since its endTime has not been reached
            await expect(
                vesting.connect(owner).vestCompletedSchedules()
            ).to.be.revertedWith("No tokens to vest");
        });

        it("vestCompletedSchedules should revert when there are no schedules to vest", async () => {
            //(DO NOT include this `enter` & `leave` block if doing separate test runs between
            //each test case, as the state of the forked testnet does not carry forward from 
            //the previous test case if the test run is stopped)
            //--------------------------------------------------------------------------------
            const enterTx1 = await purseStaking.connect(owner).enter(BigInt(2000000 * 10 ** 18));
            await enterTx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const leaveTx1 = await purseStaking.connect(owner).leave(BigInt(2000000 * 10 ** 18));
            await leaveTx1.wait();
            //--------------------------------------------------------------------------------

            //Confirm there is at least one vesting schedule
            const numSchedulesBefore = await vesting.numVestingSchedules(owner.address);
            expect(numSchedulesBefore).to.be.gt(BigInt(0));

            //Vesting should revert since none of the schdules have reached their endTime
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