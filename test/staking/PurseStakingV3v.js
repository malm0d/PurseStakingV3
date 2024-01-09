const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
require("dotenv").config();

//Tests for PurseStakingV3 vesting logic.

//npx hardhat test test/staking/PurseStakingV3v.js --network bsctestnet
describe("PurseStakingV3v Tests", function () {
    const PURSE_STAKING = "PurseStakingV3v";
    const PURSE_STAKING_VESTING = "PurseStakingVesting";

    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKING_ADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const PURSESTAKINGVESTING_ADDRESS = "0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053";
    const LOCKPERIOD = BigInt("1814400")

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
        it("PurseStakingV3v has the correct vesting address", async () => {
            const vestingAddress = await purseStaking.vesting();
            assert.equal(vestingAddress, PURSESTAKINGVESTING_ADDRESS);
        });
    });

    describe("Access control:", function () {
        it("updateVesting can only be called by owner", async () => {
            await expect(
                purseStaking.connect(userB).updateVesting(ZEROADDRESS)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("sendVestedPurse can only be called by vesting contract", async () => {
            await expect(
                purseStaking.connect(owner).sendVestedPurse(BigInt(1 * 10 ** 18))
            ).to.be.revertedWith("PurseStakingV3: msg.sender is not the vesting contract");
        });
    });

    describe("Update contract addresses:", function () {
        it("updateVesting updates vesting variable to the correct value", async () => {
            const tx1 = await purseStaking.updateVesting(userB.address);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const vestingAddress1 = await purseStaking.vesting();
            expect(vestingAddress1).to.equal(userB.address);
            const tx2 = await purseStaking.updateVesting(PURSESTAKINGVESTING_ADDRESS);
            await tx2.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const vestingAddress2 = await purseStaking.vesting();
            expect(vestingAddress2).to.equal(PURSESTAKINGVESTING_ADDRESS);
        });
    });

    describe("Functionality:", function () {
        it("Calling leave creates a vesting schedule with the correct values," +
            "& total locked amount increases",
            async () => {
                //Get locked amount before leave
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Unstake 50,000 PURSE
                const tx1 = await purseStaking.connect(owner).leave(BigInt(50000 * 10 ** 18));
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                //Get vesting schedule from vesting
                const numberOfVestingSchedules = await vesting.numVestingSchedules(owner.address);
                expect(numberOfVestingSchedules).to.equal(BigInt(1));

                //Check values of vesting schedule
                const vestingSchedule = await vesting.getVestingScheduleAtIndex(owner.address, 0);
                const vestingStartTime = vestingSchedule[0];
                const vestingEndTime = vestingSchedule[1];
                const vestingAmount = vestingSchedule[2];
                const lockDuration = vestingEndTime - vestingStartTime;
                expect(vestingAmount).to.be.gte(BigInt(50000 * 10 ** 18));
                expect(lockDuration).to.equal(LOCKPERIOD);

                //Get locked amount after leave.
                //Increment in locked amount maybe more because leave function adds rewards to withdrawn amount
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.be.gt(totalLockedAmountBefore);
            }
        );

        it("Repeat of above test albeit with a different user",
            async () => {
                //Get locked amount before leave
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Unstake 50,000 PURSE
                const tx1 = await purseStaking.connect(userC).leave(BigInt(50000 * 10 ** 18));
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                //Get vesting schedule from vesting
                const numberOfVestingSchedules = await vesting.numVestingSchedules(userC.address);
                expect(numberOfVestingSchedules).to.equal(BigInt(1));

                //Check values of vesting schedule
                const vestingSchedule = await vesting.getVestingScheduleAtIndex(userC.address, 0);
                const vestingStartTime = vestingSchedule[0];
                const vestingEndTime = vestingSchedule[1];
                const vestingAmount = vestingSchedule[2];
                const lockDuration = vestingEndTime - vestingStartTime;
                expect(vestingAmount).to.be.gte(BigInt(50000 * 10 ** 18));
                expect(lockDuration).to.equal(LOCKPERIOD);

                //Get locked amount after leave.
                //Increment in locked amount maybe more because leave function adds rewards to leave amount
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.be.gt(totalLockedAmountBefore);
            }
        );

        it("Calling leave again creates another vesting schedule with the correct values," +
            "& total locked amount increases",
            async () => {
                //Get locked amount before leave
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Unstake 100,000 PURSE
                const tx1 = await purseStaking.connect(userC).leave(BigInt(100000 * 10 ** 18));
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                //Get vesting schedules from vesting
                const numberOfVestingSchedules = await vesting.numVestingSchedules(userC.address);
                expect(numberOfVestingSchedules).to.equal(BigInt(2));

                //Check values of vesting schedule
                const vestingSchedule2 = await vesting.getVestingScheduleAtIndex(userC.address, 1);
                const vestingStartTime2 = vestingSchedule2[0];
                const vestingEndTime2 = vestingSchedule2[1];
                const vestingAmount2 = vestingSchedule2[2];
                const lockDuration2 = vestingEndTime2 - vestingStartTime2;
                expect(vestingAmount2).to.be.gte(BigInt(100000 * 10 ** 18));
                expect(lockDuration2).to.equal(LOCKPERIOD);

                //Get locked amount after leave.
                //Increment in locked amount maybe more because leave function adds rewards to leave amount
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.be.gt(totalLockedAmountBefore);

                //End times are not the same
                const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(userC.address, 0);
                const vestingEndTime1 = vestingSchedule1[1];

                expect(vestingEndTime2).to.be.gt(vestingEndTime1);
            }
        );

        it("Repeat of above test albeit with a different user",
            async () => {
                //Get locked amount before leave
                const totalLockedAmountBefore = await purseStaking.totalLockedAmount();

                //Unstake 100,000 PURSE
                const tx1 = await purseStaking.connect(owner).leave(BigInt(100000 * 10 ** 18));
                await tx1.wait();
                await new Promise(resolve => setTimeout(resolve, 5000));

                //Get vesting schedules from vesting
                const numberOfVestingSchedules = await vesting.numVestingSchedules(owner.address);
                expect(numberOfVestingSchedules).to.equal(BigInt(2));

                //Check values of vesting schedule
                const vestingSchedule2 = await vesting.getVestingScheduleAtIndex(owner.address, 1);
                const vestingStartTime2 = vestingSchedule2[0];
                const vestingEndTime2 = vestingSchedule2[1];
                const vestingAmount2 = vestingSchedule2[2];
                const lockDuration2 = vestingEndTime2 - vestingStartTime2;
                expect(vestingAmount2).to.be.gte(BigInt(100000 * 10 ** 18));
                expect(lockDuration2).to.equal(LOCKPERIOD);

                //Get locked amount after leave.
                //Increment in locked amount maybe more because leave function adds rewards to leave amount
                const totalLockedAmountAfter = await purseStaking.totalLockedAmount();
                expect(totalLockedAmountAfter).to.be.gt(totalLockedAmountBefore);

                //End times are not the same
                const vestingSchedule1 = await vesting.getVestingScheduleAtIndex(owner.address, 0);
                const vestingEndTime1 = vestingSchedule1[1];

                expect(vestingEndTime2).to.be.gt(vestingEndTime1);
            }
        );
    });
});