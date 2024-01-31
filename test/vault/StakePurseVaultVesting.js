const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
require("dotenv").config();
const helpers = require("@nomicfoundation/hardhat-network-helpers");

//Tests for StakePurseVaultVesting contract

//Testnet: npx hardhat test test/vault/StakePurseVaultVesting.js --network bsctestnet
//Forked: npx hardhat test test/vault/StakePurseVaultVesting.js --network hardhat

//IMPT: "Functionality" tests will be done on a forked bsc testnet, so DO NOT run it together
//with the other tests: "Pre-conditions", "Access control", "Update contract addresses".
describe("StakePurseVaultVesting Tests", function () {
    const PURSE_STKAING_VESTING = "PurseStakingVesting";

    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKINGVESTING_ADDRESS = "0x74019d73c9E4d6FE5610C20df6b0FFCe365c4053";
    const STAKEPURSEVAULT_ADDRESS = "0x1503B2Dd085e5fA4a88f3968EE4f063aa35348B9";
    const STAKEPURSEVAULTVESTING_ADDRESS = "0x1cddE3BB0DaF9Def56F7e5e5B8BfDFd6689160A7";
    const STAKEPURSEVAULTTREASURY_ADDRESS = "0xA95B5650c6D525a8d82E6Ec766d1c6DF7eC0c4e7";

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let owner;
    let userB;

    let purse;
    let purseStakingVesting;
    let stakePurseVault;
    let stakePurseVaultVesting;
    let stakePurseVaultTreasury;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        userB = signers[1];

        purse = await hre.ethers.getContractAt(
            PURSE_BSC_ABI,
            PURSE_ADDRESS,
            owner
        );

        purseStakingVesting = await hre.ethers.getContractAt(
            PURSE_STKAING_VESTING,
            PURSESTAKINGVESTING_ADDRESS,
            owner
        );

        stakePurseVault = await hre.ethers.getContractAt(
            "StakePurseVault",
            STAKEPURSEVAULT_ADDRESS,
            owner
        );

        stakePurseVaultVesting = await hre.ethers.getContractAt(
            "StakePurseVaultVesting",
            STAKEPURSEVAULTVESTING_ADDRESS,
            owner
        );

        stakePurseVaultTreasury = await hre.ethers.getContractAt(
            "StakePurseVaultTreasury",
            STAKEPURSEVAULTTREASURY_ADDRESS,
            owner
        );
    });

    describe("Pre-conditions:", function () {
        it("StakePurseVaultVesting has the correct vault and treasury contract address", async () => {
            const vaultAddress = await stakePurseVaultVesting.getStakePurseVault();
            const vaultTreasuryAddress = await stakePurseVaultVesting.getStakePurseVaultTreasury();
            expect(vaultAddress).to.equal(STAKEPURSEVAULT_ADDRESS);
            expect(vaultTreasuryAddress).to.equal(STAKEPURSEVAULTTREASURY_ADDRESS);
        });
    });

    describe("Access control:", function () {
        it("lockWithEndTime cannot be called by non StakePurseVault", async () => {
            await expect(
                stakePurseVaultVesting.connect(owner).lockWithEndTime(owner.address, 100, 100)
            ).to.be.revertedWith("Only StakePurseVault can call");
        });

        it("updateStakePurseVault cannot be called by non owner", async () => {
            await expect(
                stakePurseVaultVesting.connect(userB).updateStakePurseVault(ZEROADDRESS)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("updateStakePurseVaultTreasury cannot be called by non owner", async () => {
            await expect(
                stakePurseVaultVesting.connect(userB).updateStakePurseVaultTreasury(ZEROADDRESS)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("recoverToken cannot be called by non owner", async () => {
            await expect(
                stakePurseVaultVesting.connect(userB).recoverToken(PURSE_ADDRESS, 100, userB.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Update contract addresses:", function () {
        it("updateStakePurseVault updates stakePurseVault variable correctly", async () => {
            const originalAddress = await stakePurseVaultVesting.getStakePurseVault();
            const tx1 = await stakePurseVaultVesting.connect(owner).updateStakePurseVault(ZEROADDRESS);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress = await stakePurseVaultVesting.getStakePurseVault();
            expect(updatedAddress).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVaultVesting.connect(owner).updateStakePurseVault(STAKEPURSEVAULT_ADDRESS);
            await tx2.wait();
            const finalAddress = await stakePurseVaultVesting.getStakePurseVault();
            expect(finalAddress).to.equal(originalAddress);
        });

        it("updateStakePurseVaultTreasury updates stakePurseVaultTreasury variable correctly", async () => {
            const originalAddress = await stakePurseVaultVesting.getStakePurseVaultTreasury();
            const tx1 = await stakePurseVaultVesting.connect(owner).updateStakePurseVaultTreasury(ZEROADDRESS);
            await tx1.wait();
            await new Promise(resolve => setTimeout(resolve, 5000));
            const updatedAddress = await stakePurseVaultVesting.getStakePurseVaultTreasury();
            expect(updatedAddress).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVaultVesting.connect(owner).updateStakePurseVaultTreasury(STAKEPURSEVAULTTREASURY_ADDRESS);
            await tx2.wait();
            const finalAddress = await stakePurseVaultVesting.getStakePurseVaultTreasury();
            expect(finalAddress).to.equal(originalAddress);
        });
    });

    describe("Functionality:", function () {
        it("Calling unstakePurse in the Vault creates a vesting schedule in both Vault and PurseStaking Vesting contracts " +
            "with the correct data",
            async () => {
                const stakeTx = await stakePurseVault.connect(owner).stakePurse(BigInt("50000000000000000000000"));
                await stakeTx.wait();

                const psv_numSchedulesBefore = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                const spvv_numSchedulesBefore = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);

                const unstakeTx = await stakePurseVault.connect(owner).unstakePurse(BigInt("5000000000000000000000"));
                await unstakeTx.wait();

                const psv_numSchedulesAfter = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                const spvv_numSchedulesAfter = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);

                expect(psv_numSchedulesAfter).to.equal(psv_numSchedulesBefore + BigInt(1));
                expect(spvv_numSchedulesAfter).to.equal(spvv_numSchedulesBefore + BigInt(1));
                expect(accountEscrowedBalanceAfter).to.be.gt(accountEscrowedBalanceBefore);
                expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore);

                const vaultPsvVestingSchedule = await purseStakingVesting.getVestingScheduleAtIndex(
                    STAKEPURSEVAULT_ADDRESS,
                    psv_numSchedulesAfter - BigInt(1)
                );
                const userSpvvVestingSchedule = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 0);

                const vaultPsvVestingScheduleStartTime = vaultPsvVestingSchedule[0];
                const vaultPsvVestingScheduleEndTime = vaultPsvVestingSchedule[1];
                const vaultPsvVestingScheduleAmount = vaultPsvVestingSchedule[2];

                const userSpvvVestingScheduleStartTime = userSpvvVestingSchedule[0];
                const userSpvvVestingScheduleEndTime = userSpvvVestingSchedule[1];
                const userSpvvVestingScheduleAmount = userSpvvVestingSchedule[2];

                expect(vaultPsvVestingScheduleStartTime).to.equal(userSpvvVestingScheduleStartTime);
                expect(vaultPsvVestingScheduleEndTime).to.equal(userSpvvVestingScheduleEndTime);
                expect(vaultPsvVestingScheduleAmount).to.be.gte(userSpvvVestingScheduleAmount);
            }
        );

        it("Calling unstakePurse in the Vault creates a second vesting schedule in both Vault and PurseStaking Vesting contracts " +
            "with the correct data",
            async () => {
                await helpers.time.increase(864000);
                const stakeTx = await stakePurseVault.connect(owner).stakePurse(BigInt("50000000000000000000000"));
                await stakeTx.wait();

                const psv_numSchedulesBefore = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                const spvv_numSchedulesBefore = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);

                const unstakeTx = await stakePurseVault.connect(owner).unstakePurse(BigInt("30000000000000000000000"));
                await unstakeTx.wait();

                const psv_numSchedulesAfter = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                const spvv_numSchedulesAfter = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);

                expect(psv_numSchedulesAfter).to.gt(BigInt(1));
                expect(spvv_numSchedulesAfter).to.gt(BigInt(1));

                expect(psv_numSchedulesAfter).to.equal(psv_numSchedulesBefore + BigInt(1));
                expect(spvv_numSchedulesAfter).to.equal(spvv_numSchedulesBefore + BigInt(1));
                expect(accountEscrowedBalanceAfter).to.gt(accountEscrowedBalanceBefore);
                expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore);

                const vaultPsvVestingSchedule = await purseStakingVesting.getVestingScheduleAtIndex(
                    STAKEPURSEVAULT_ADDRESS,
                    psv_numSchedulesAfter - BigInt(1)
                );
                const userSpvvVestingSchedule = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 1);

                const vaultPsvVestingScheduleStartTime = vaultPsvVestingSchedule[0];
                const vaultPsvVestingScheduleEndTime = vaultPsvVestingSchedule[1];
                const vaultPsvVestingScheduleAmount = vaultPsvVestingSchedule[2];

                const userSpvvVestingScheduleStartTime = userSpvvVestingSchedule[0];
                const userSpvvVestingScheduleEndTime = userSpvvVestingSchedule[1];
                const userSpvvVestingScheduleAmount = userSpvvVestingSchedule[2];

                expect(vaultPsvVestingScheduleStartTime).to.equal(userSpvvVestingScheduleStartTime);
                expect(vaultPsvVestingScheduleEndTime).to.equal(userSpvvVestingScheduleEndTime);
                expect(vaultPsvVestingScheduleAmount).to.be.gte(userSpvvVestingScheduleAmount);
            }
        );

        it("vestCompletedSchedules should complete one vesting schedule: " +
            "numVestingSchedules, escrowed, vested, purse balances, should adjust correctly",
            async () => {
                //Get user first vesting schedule in StakePurseVaultVesting
                const userSpvvVestingSchedule1 = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 0);
                const userSpvvVestingSchedule1StartTime = userSpvvVestingSchedule1[0];
                const userSpvvVestingSchedule1EndTime = userSpvvVestingSchedule1[1];
                const userSpvvVestingSchedule1Amount = userSpvvVestingSchedule1[2];

                await helpers.time.increaseTo(userSpvvVestingSchedule1EndTime);

                //Get other values in StakePurseVaultVesting expected to change after vesting
                const spvv_numSchedulesBefore = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);
                const userBalanceBefore = await purse.balanceOf(owner.address);
                const stakePurseVaultBalanceBefore = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);

                //Get number of schedules in PurseStakingVesting
                const psv_numSchedulesBefore = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);

                //Get Vault treasury balance
                const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);

                //Get corresponding schedule amount in PurseStakingVesting
                const psvVestingSchedule1 = await purseStakingVesting.getVestingScheduleAtIndex(
                    STAKEPURSEVAULT_ADDRESS,
                    psv_numSchedulesBefore - BigInt(2)
                );
                const psvVestingSchedule1Amount = psvVestingSchedule1[2];

                //Vest ONE completed schedule
                const vestTx = await stakePurseVaultVesting.connect(owner).vestCompletedSchedules();
                await vestTx.wait();

                //Number of schedules in both contracts should decrease by 1
                const spvv_numSchedulesAfter = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const psv_numSchedulesAfter = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                expect(spvv_numSchedulesAfter).to.equal(spvv_numSchedulesBefore - BigInt(1));
                expect(psv_numSchedulesAfter).to.equal(psv_numSchedulesBefore - BigInt(1));

                //Escrowed balance should decrease by the amount of the completed schedule
                const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                expect(accountEscrowedBalanceAfter).to.equal(accountEscrowedBalanceBefore - userSpvvVestingSchedule1Amount);

                //Account vested balance should increase by the amount of the completed schedule
                const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);
                expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore + userSpvvVestingSchedule1Amount);

                //User balance should increase by the amount of the completed schedule
                const userBalanceAfter = await purse.balanceOf(owner.address);
                expect(userBalanceAfter).to.equal(userBalanceBefore + userSpvvVestingSchedule1Amount);

                //Vault treasury balance should not change
                const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
                expect(vaultTreasuryBalanceAfter).to.equal(vaultTreasuryBalanceBefore);

                //StakePurseVault balance should increase because of PurseStaking mechanism
                const stakePurseVaultBalanceAfter = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
                expect(stakePurseVaultBalanceAfter).to.be.gt(stakePurseVaultBalanceBefore);
                expect(stakePurseVaultBalanceAfter).to.equal(
                    stakePurseVaultBalanceBefore + psvVestingSchedule1Amount - userSpvvVestingSchedule1Amount
                );
            }
        );

        it("vestCompletedSchedules should complete all vesting schedules: " +
            "numVestingSchedules, escrowed, vested, purse balances, should adjust correctly",
            async () => {
                await helpers.time.increase(864000);

                const unstakeTx = await stakePurseVault.connect(owner).unstakePurse(BigInt(7777 * 10 ** 18));
                await unstakeTx.wait();

                //Get user first vesting schedule in StakePurseVaultVesting
                const userSpvvVestingSchedule1 = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 0);
                const userSpvvVestingSchedule1StartTime = userSpvvVestingSchedule1[0];
                const userSpvvVestingSchedule1EndTime = userSpvvVestingSchedule1[1];
                const userSpvvVestingSchedule1Amount = userSpvvVestingSchedule1[2];

                //Get user second vesting schedule in StakePurseVaultVesting
                const userSpvvVestingSchedule2 = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 1);
                const userSpvvVestingSchedule2StartTime = userSpvvVestingSchedule2[0];
                const userSpvvVestingSchedule2EndTime = userSpvvVestingSchedule2[1];
                const userSpvvVestingSchedule2Amount = userSpvvVestingSchedule2[2];

                //Get other values in StakePurseVaultVesting expected to change after vesting
                const spvv_numSchedulesBefore = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);
                const userBalanceBefore = await purse.balanceOf(owner.address);
                const stakePurseVaultBalanceBefore = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);

                //Get number of schedules in PurseStakingVesting
                const psv_numSchedulesBefore = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);

                //Get Vault treasury balance
                const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);

                //Get corresponding schedule 1 amount in PurseStakingVesting
                const psvVestingSchedule1 = await purseStakingVesting.getVestingScheduleAtIndex(
                    STAKEPURSEVAULT_ADDRESS,
                    psv_numSchedulesBefore - BigInt(2)
                );
                const psvVestingSchedule1Amount = psvVestingSchedule1[2];

                //Get corresponding schedule 2 amount in PurseStakingVesting
                const psvVestingSchedule2 = await purseStakingVesting.getVestingScheduleAtIndex(
                    STAKEPURSEVAULT_ADDRESS,
                    psv_numSchedulesBefore - BigInt(1)
                );
                const psvVestingSchedule2Amount = psvVestingSchedule2[2];

                //Forward time to end of second schedule
                await helpers.time.increaseTo(userSpvvVestingSchedule2EndTime);

                //Vest all completed schedule
                const vestTx = await stakePurseVaultVesting.connect(owner).vestCompletedSchedules();
                await vestTx.wait();

                //Number of schedules in both contracts should decrease by 2
                const spvv_numSchedulesAfter = await stakePurseVaultVesting.numVestingSchedules(owner.address);
                const psv_numSchedulesAfter = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
                expect(spvv_numSchedulesAfter).to.equal(spvv_numSchedulesBefore - BigInt(2));
                expect(spvv_numSchedulesAfter).to.equal(BigInt(0));
                expect(psv_numSchedulesAfter).to.equal(psv_numSchedulesBefore - BigInt(2));

                //Escrowed balance should decrease by the amount of the completed schedule
                const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
                expect(accountEscrowedBalanceAfter).to.equal(
                    accountEscrowedBalanceBefore - userSpvvVestingSchedule1Amount - userSpvvVestingSchedule2Amount
                );

                //Account vested balance should increase by the amount of the completed schedule
                const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);
                expect(accountVestedBalanceAfter).to.equal(
                    accountVestedBalanceBefore + userSpvvVestingSchedule1Amount + userSpvvVestingSchedule2Amount
                );

                //User balance should increase by the amount of the completed schedule
                const userBalanceAfter = await purse.balanceOf(owner.address);
                expect(userBalanceAfter).to.equal(
                    userBalanceBefore + userSpvvVestingSchedule1Amount + userSpvvVestingSchedule2Amount
                );

                //Vault treasury balance should not change
                const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
                expect(vaultTreasuryBalanceAfter).to.equal(vaultTreasuryBalanceBefore);

                //StakePurseVault balance should increase because of PurseStaking mechanism
                const stakePurseVaultBalanceAfter = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
                expect(stakePurseVaultBalanceAfter).to.be.gt(stakePurseVaultBalanceBefore);
                expect(stakePurseVaultBalanceAfter).to.equal(
                    stakePurseVaultBalanceBefore +
                    psvVestingSchedule1Amount +
                    psvVestingSchedule2Amount -
                    userSpvvVestingSchedule1Amount -
                    userSpvvVestingSchedule2Amount
                );
            }
        );

        it("vestCompletedSchedules should revert when there are no schedules to vest", async () => {
            const vestPeriod = await stakePurseVault.vestDuration();
            const unstake1 = await stakePurseVault.connect(owner).unstakePurse(BigInt(1000 * 10 ** 18));
            await unstake1.wait();
            await helpers.time.increase(Number(vestPeriod) / 2);
            const unstake2 = await stakePurseVault.connect(owner).unstakePurse(BigInt(500 * 10 ** 18));
            await unstake2.wait();

            const userBalanceBefore = await purse.balanceOf(owner.address);
            const vaultBalanceBefore = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);

            const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
            const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);

            //confirm multiple schedules exist
            const numSchedules = await stakePurseVaultVesting.numVestingSchedules(owner.address);
            expect(numSchedules).to.be.gt(BigInt(1));

            //Vesting should revert since there are no completed schedules
            await expect(
                stakePurseVaultVesting.connect(owner).vestCompletedSchedules()
            ).to.be.revertedWith("No tokens to vest");

            //User and Vault balance should not change
            const userBalanceAfter = await purse.balanceOf(owner.address);
            const vaultBalanceAfter = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
            expect(userBalanceAfter).to.equal(userBalanceBefore);
            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore);

            //Escrowed and vested balances should not change
            const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
            const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);
            expect(accountEscrowedBalanceAfter).to.equal(accountEscrowedBalanceBefore);
            expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore);
        });

        it("vestCompletedSchedules should revert when a second schedule is not completed yet", async () => {
            //Confirm more than 1 schedule exists
            const numSchedules = await stakePurseVaultVesting.numVestingSchedules(owner.address);
            expect(numSchedules).to.be.gt(BigInt(1));

            const userVestingSchedule1 = await stakePurseVaultVesting.getVestingScheduleAtIndex(owner.address, 0);
            const userVestingEndTime1 = userVestingSchedule1[1];
            const userVestingAmount1 = userVestingSchedule1[2];

            //Forward time to end of first schedule
            await helpers.time.increaseTo(userVestingEndTime1);

            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const vaultBalanceBefore = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const accountEscrowedBalanceBefore = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
            const accountVestedBalanceBefore = await stakePurseVaultVesting.accountVestedBalance(owner.address);
            const spvv_numSchedulesBefore = await stakePurseVaultVesting.numVestingSchedules(owner.address);
            const psv_numSchedulesBefore = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);

            const psvVestingSchedule1 = await purseStakingVesting.getVestingScheduleAtIndex(
                STAKEPURSEVAULT_ADDRESS,
                psv_numSchedulesBefore - BigInt(2)
            );
            const psvVestingSchedule1Amount = psvVestingSchedule1[2];

            //Vest completed schedule
            const vestTx = await stakePurseVaultVesting.connect(owner).vestCompletedSchedules();
            await vestTx.wait();

            //Number of schedules in both contracts should decrease by 1
            const spvv_numSchedulesAfter = await stakePurseVaultVesting.numVestingSchedules(owner.address);
            const psv_numSchedulesAfter = await purseStakingVesting.numVestingSchedules(STAKEPURSEVAULT_ADDRESS);
            expect(spvv_numSchedulesAfter).to.equal(spvv_numSchedulesBefore - BigInt(1));
            expect(psv_numSchedulesAfter).to.equal(psv_numSchedulesBefore - BigInt(1));

            //User PURSE balance should increase by the correct amount
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            expect(userPurseBalanceAfter).to.be.gt(userPurseBalanceBefore);
            expect(userPurseBalanceAfter).to.equal(userPurseBalanceBefore + userVestingAmount1);

            //Account escrowed should reduce and account vested should increase by the correct amount
            const accountEscrowedBalanceAfter = await stakePurseVaultVesting.accountEscrowedBalance(owner.address);
            const accountVestedBalanceAfter = await stakePurseVaultVesting.accountVestedBalance(owner.address);
            expect(accountEscrowedBalanceAfter).to.equal(accountEscrowedBalanceBefore - userVestingAmount1);
            expect(accountVestedBalanceAfter).to.equal(accountVestedBalanceBefore + userVestingAmount1);

            //Vault balance increases accordingly
            const vaultBalanceAfter = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
            expect(vaultBalanceAfter).to.be.gt(vaultBalanceBefore);
            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + psvVestingSchedule1Amount - userVestingAmount1);
        });

        it("recoverToken should recover the correct amount of tokens", async () => {
            const userBalanceBefore = await purse.balanceOf(owner.address);
            const vestingBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTVESTING_ADDRESS);

            const tx = await purse.connect(owner).transfer(STAKEPURSEVAULTVESTING_ADDRESS, BigInt(100));
            await tx.wait();

            await expect(
                stakePurseVaultVesting.connect(owner).recoverToken(PURSE_ADDRESS, BigInt(100), ZEROADDRESS)
            ).to.be.revertedWith("Cannot transfer to zero address");

            await expect(
                stakePurseVaultVesting.connect(owner).recoverToken(ZEROADDRESS, BigInt(100), owner.address)
            ).to.be.revertedWith("Token cannot be zero address");

            const recoverTx = await stakePurseVaultVesting.connect(owner).recoverToken(PURSE_ADDRESS, BigInt(100), owner.address);
            await recoverTx.wait();

            const userBalanceAfter = await purse.balanceOf(owner.address);
            const vestingBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTVESTING_ADDRESS);

            expect(userBalanceAfter).to.equal(userBalanceBefore);
            expect(vestingBalanceAfter).to.equal(vestingBalanceBefore);
        });
    });
});