const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
const BEP20_ABI = require("../../abis/BEP20.json");
const VAULT_REWARD_DISTRIBUTOR_ABI = require("../../abis/VaultRewardDistributor.json");
require("dotenv").config();
const helpers = require("@nomicfoundation/hardhat-network-helpers");

//Tests for StakePurseVault contract

//Testnet: npx hardhat test test/vault/StakePurseVault.js --network bsctestnet
//Forked: npx hardhat test test/vault/StakePurseVault.js --network hardhat

//IMPT: "Functionality" tests will be done on a forked bsc testnet, so DO NOT run it together
//with the other tests: "Pre-conditions", "Access control", "Update contract addresses".
describe("StakePurseVault Tests", function () {
    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const PURSESTAKING_ADDRESS = "0x8A6aFc7D27cDFf9FDC6b4efa63a757333eB58508";
    const PURSESTAKINGTREASURY_ADDRESS = "0x774029863759eEd41B6f7Fe12dc5D44Ec9eD4bCB";

    const STAKEPURSEVAULT_ADDRESS = "0x1503B2Dd085e5fA4a88f3968EE4f063aa35348B9";
    const STAKEPURSEVAULTVESTING_ADDRESS = "0x1cddE3BB0DaF9Def56F7e5e5B8BfDFd6689160A7";
    const STAKEPURSEVAULTTREASURY_ADDRESS = "0xA95B5650c6D525a8d82E6Ec766d1c6DF7eC0c4e7";
    const VAULTREWARDDISTRIBUTOR_ADDRESS = "0xD9fab2a4C31030a76298db1F3Cc65afbFE4006B0";

    const VEST_DURATION_AMOUNT = BigInt("1814400"); //21 days
    const MIN_COMPOUND_AMOUNT = BigInt("500000000000000000000") //500 ETHER
    const CAP_STAKE_PURSE_AMOUNT = BigInt("100000000000000000000000000") //100,000,000 ETHER
    const FEEONCOMPOUNDER_AMOUNT = BigInt("500");
    const FEEONREWARD_AMOUNT = BigInt("100");
    const FEEONWITHDRAWAL_AMOUNT = BigInt("50");
    const BIPS_DIVISOR = BigInt("10000");

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let ownerAndGov; //deployer has both owner and governor roles
    let userB;

    let purse;
    let purseStaking;
    let purseStakingTreasury;

    let stakePurseVault;
    let stakePurseVaultVesting;
    let stakePurseVaultTreasury;
    let vaultRewardDistributor;
    let rewardDistributorRewardToken;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        userB = signers[1];

        purse = await hre.ethers.getContractAt(
            PURSE_BSC_ABI,
            PURSE_ADDRESS,
            ownerAndGov
        );

        purseStaking = await hre.ethers.getContractAt(
            "PurseStakingV3v",
            PURSESTAKING_ADDRESS,
            ownerAndGov
        );

        purseStakingTreasury = await hre.ethers.getContractAt(
            "Treasury",
            PURSESTAKINGTREASURY_ADDRESS,
            ownerAndGov
        );

        stakePurseVault = await hre.ethers.getContractAt(
            "StakePurseVault",
            STAKEPURSEVAULT_ADDRESS,
            ownerAndGov
        );

        stakePurseVaultVesting = await hre.ethers.getContractAt(
            "StakePurseVaultVesting",
            STAKEPURSEVAULTVESTING_ADDRESS,
            ownerAndGov
        );

        stakePurseVaultTreasury = await hre.ethers.getContractAt(
            "StakePurseVaultTreasury",
            STAKEPURSEVAULTTREASURY_ADDRESS,
            ownerAndGov
        );

        //owner here is not the owner of the vault reward distributor contract
        vaultRewardDistributor = await hre.ethers.getContractAt(
            VAULT_REWARD_DISTRIBUTOR_ABI,
            VAULTREWARDDISTRIBUTOR_ADDRESS,
            ownerAndGov
        );

        rewardDistributorRewardToken = await hre.ethers.getContractAt(
            BEP20_ABI,
            await vaultRewardDistributor.rewardToken(),
            ownerAndGov
        );

    });

    describe("Pre-conditions:", function () {
        it("purseStaking is the correct address", async () => {
            const purseStakingAddress = await stakePurseVault.purseStaking();
            expect(purseStakingAddress).to.equal(PURSESTAKING_ADDRESS);
        });

        it("purseStakingTreasury is the correct address", async () => {
            const purseStakingTreasuryAddress = await stakePurseVault.purseStakingTreasury();
            expect(purseStakingTreasuryAddress).to.equal(PURSESTAKINGTREASURY_ADDRESS);
        });

        it("stakePurseVaultVesting is the correct address", async () => {
            const stakePurseVaultVestingAddress = await stakePurseVault.stakePurseVaultVesting();
            expect(stakePurseVaultVestingAddress).to.equal(STAKEPURSEVAULTVESTING_ADDRESS);
        });

        it("stakePurseVaultTreasury is the correct address", async () => {
            const stakePurseVaultTreasuryAddress = await stakePurseVault.stakePurseVaultTreasury();
            expect(stakePurseVaultTreasuryAddress).to.equal(STAKEPURSEVAULTTREASURY_ADDRESS);
        });

        it("vaultRewardDistributor is the correct address", async () => {
            const vaultRewardDistributorAddress = await stakePurseVault.vaultRewardDistributor();
            expect(vaultRewardDistributorAddress).to.equal(VAULTREWARDDISTRIBUTOR_ADDRESS);
        });
    });

    describe("Access control:", function () {
        it("sendVestedPurse cannot be called by non stakePurseVaultVesting", async () => {
            await expect(
                stakePurseVault.connect(owner).sendVestedPurse(1000)
            ).to.be.revertedWith("Only VestedPurse can call");
        });

        it("updateVaultConfigs cannot be called by non GOVERNOR", async () => {
            await expect(
                stakePurseVault.connect(userB).updateVaultConfigs(
                    MIN_COMPOUND_AMOUNT,
                    CAP_STAKE_PURSE_AMOUNT
                )
            ).to.be.reverted;
        });

        it("updateVaultFees cannot be called by non GOVERNOR", async () => {
            await expect(
                stakePurseVault.connect(userB).updateVaultFees(
                    FEEONCOMPOUNDER_AMOUNT,
                    FEEONREWARD_AMOUNT,
                    FEEONWITHDRAWAL_AMOUNT
                )
            ).to.be.reverted;
        });

        it("updateStakePurseVaultVesting cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updateStakePurseVaultVesting(userB.address)
            ).to.be.reverted;
        });

        it("updateStakePurseVaultTreasury cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updateStakePurseVaultTreasury(ZEROADDRESS)
            ).to.be.reverted;
        });

        it("updateVaultRewardDistributor cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updateVaultRewardDistributor(ZEROADDRESS)
            ).to.be.reverted;
        });

        it("updatePurseStaking cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updatePurseStaking(ZEROADDRESS)
            ).to.be.reverted;
        });

        it("updatePurseStakingTreasury cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updatePurseStakingTreasury(ZEROADDRESS)
            ).to.be.reverted;
        });

        it("updateVestDuration cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).updateVestDuration(1)
            ).to.be.reverted;
        });

        it("recoverToken cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).recoverToken(
                    PURSE_ADDRESS,
                    10,
                    userB.address
                )
            ).to.be.reverted;
        });

        it("pause cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).pause()
            ).to.be.reverted;
        });

        it("unpause cannot be called by non OWNER", async () => {
            await expect(
                stakePurseVault.connect(userB).unpause()
            ).to.be.reverted;
        });

        //IMPT: Pause contract for next two test cases
        it("stakePurse cannot be called while contract is paused", async () => {
            const pauseTx = await stakePurseVault.connect(owner).pause();
            await pauseTx.wait();
            await new Promise(r => setTimeout(r, 5000));
            await expect(
                stakePurseVault.connect(userB).stakePurse(1)
            ).to.be.revertedWith("Pausable: paused");
        });

        //IMPT: Unpause contract at end of this test case
        it("compound cannot be called when contract is paused", async () => {
            await expect(
                stakePurseVault.connect(userB).compound()
            ).to.be.revertedWith("Pausable: paused");
            const unpauseTx = await stakePurseVault.connect(owner).unpause();
            await unpauseTx.wait();
            await new Promise(r => setTimeout(r, 5000));
        });
    });

    describe("Update contract addresses and configs:", function () {
        it("updateVaultConfigs updates minCompoundAmount and capStakePurseAmount correctly", async () => {
            const configsPre = await stakePurseVault.getVaultConfigs();
            const minCompoundAmountBefore = configsPre[0];
            const capStakePurseAmountBefore = configsPre[1];

            const tx1 = await stakePurseVault.connect(owner).updateVaultConfigs(0, 0);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));

            const configsUpdated = await stakePurseVault.getVaultConfigs();
            const minCompoundAmountUpdated = configsUpdated[0];
            const capStakePurseAmountUpdated = configsUpdated[1];

            expect(minCompoundAmountUpdated).not.equal(minCompoundAmountBefore);
            expect(capStakePurseAmountUpdated).not.equal(capStakePurseAmountBefore);

            const tx2 = await stakePurseVault.connect(owner).updateVaultConfigs(
                MIN_COMPOUND_AMOUNT,
                CAP_STAKE_PURSE_AMOUNT
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));

            const configsAfter = await stakePurseVault.getVaultConfigs();
            const minCompoundAmountAfter = configsAfter[0];
            const capStakePurseAmountAfter = configsAfter[1];

            expect(minCompoundAmountAfter).to.equal(MIN_COMPOUND_AMOUNT);
            expect(capStakePurseAmountAfter).to.equal(CAP_STAKE_PURSE_AMOUNT);
        });

        it("updateVaultFees updates feeOnCompounder, feeOnReward and feeOnWithdrawal correctly", async () => {
            const feeOnRewardBefore = await stakePurseVault.feeOnReward();
            const feeOnCompoundBefore = await stakePurseVault.feeOnCompounder();
            const feeOnWithdrawalBefore = await stakePurseVault.feeOnWithdrawal();

            const tx1 = await stakePurseVault.connect(owner).updateVaultFees(0, 0, 0);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));

            const feeOnRewardUpdated = await stakePurseVault.feeOnReward();
            const feeOnCompoundUpdated = await stakePurseVault.feeOnCompounder();
            const feeOnWithdrawalUpdated = await stakePurseVault.feeOnWithdrawal();

            expect(feeOnRewardUpdated).not.equal(feeOnRewardBefore);
            expect(feeOnCompoundUpdated).not.equal(feeOnCompoundBefore);
            expect(feeOnWithdrawalUpdated).not.equal(feeOnWithdrawalBefore);

            const tx2 = await stakePurseVault.connect(owner).updateVaultFees(
                FEEONREWARD_AMOUNT,
                FEEONCOMPOUNDER_AMOUNT,
                FEEONWITHDRAWAL_AMOUNT
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));

            const feeOnRewardAfter = await stakePurseVault.feeOnReward();
            const feeOnCompoundAfter = await stakePurseVault.feeOnCompounder();
            const feeOnWithdrawalAfter = await stakePurseVault.feeOnWithdrawal();

            expect(feeOnRewardAfter).to.equal(FEEONREWARD_AMOUNT);
            expect(feeOnCompoundAfter).to.equal(FEEONCOMPOUNDER_AMOUNT);
            expect(feeOnWithdrawalAfter).to.equal(FEEONWITHDRAWAL_AMOUNT);
        });

        it("updateStakePurseVaultVesting updates stakePurseVaultVesting correctly", async () => {
            const originalAddress = await stakePurseVault.stakePurseVaultVesting();
            const tx1 = await stakePurseVault.connect(owner).updateStakePurseVaultVesting(ZEROADDRESS);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultVestingAddressUpdated = await stakePurseVault.stakePurseVaultVesting();
            expect(vaultVestingAddressUpdated).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVault.connect(owner).updateStakePurseVaultVesting(
                STAKEPURSEVAULTVESTING_ADDRESS
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultVestingAddressAfter = await stakePurseVault.stakePurseVaultVesting();
            expect(vaultVestingAddressAfter).to.equal(originalAddress);
        });

        it("updateStakePurseVaultTreasury updates stakePurseVaultTreasury correctly", async () => {
            const originalAddress = await stakePurseVault.stakePurseVaultTreasury();
            const tx1 = await stakePurseVault.connect(owner).updateStakePurseVaultTreasury(ZEROADDRESS);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultTreasuryAddressUpdated = await stakePurseVault.stakePurseVaultTreasury();
            expect(vaultTreasuryAddressUpdated).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVault.connect(owner).updateStakePurseVaultTreasury(
                STAKEPURSEVAULTTREASURY_ADDRESS
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultTreasuryAddressAfter = await stakePurseVault.stakePurseVaultTreasury();
            expect(vaultTreasuryAddressAfter).to.equal(originalAddress);
        });

        it("updateVaultRewardDistributor updates vaultRewardDistributor correctly", async () => {
            const originalAddress = await stakePurseVault.vaultRewardDistributor();
            const tx1 = await stakePurseVault.connect(owner).updateVaultRewardDistributor(ZEROADDRESS);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultRewardDistributorAddressUpdated = await stakePurseVault.vaultRewardDistributor();
            expect(vaultRewardDistributorAddressUpdated).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVault.connect(owner).updateVaultRewardDistributor(
                VAULTREWARDDISTRIBUTOR_ADDRESS
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultRewardDistributorAddressAfter = await stakePurseVault.vaultRewardDistributor();
            expect(vaultRewardDistributorAddressAfter).to.equal(originalAddress);
        });

        it("updatePurseStaking updates purseStaking correctly", async () => {
            const originalAddress = await stakePurseVault.purseStaking();
            const tx1 = await stakePurseVault.connect(owner).updatePurseStaking(ZEROADDRESS);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const purseStakingAddressUpdated = await stakePurseVault.purseStaking();
            expect(purseStakingAddressUpdated).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVault.connect(owner).updatePurseStaking(
                PURSESTAKING_ADDRESS
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const purseStakingAddressAfter = await stakePurseVault.purseStaking();
            expect(purseStakingAddressAfter).to.equal(originalAddress);
        });

        it("updatePurseStakingTreasury updates purseStakingTreasury correctly", async () => {
            const originalAddress = await stakePurseVault.purseStakingTreasury();
            const tx1 = await stakePurseVault.connect(owner).updatePurseStakingTreasury(ZEROADDRESS);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const purseStakingTreasuryAddressUpdated = await stakePurseVault.purseStakingTreasury();
            expect(purseStakingTreasuryAddressUpdated).to.equal(ZEROADDRESS);

            const tx2 = await stakePurseVault.connect(owner).updatePurseStakingTreasury(
                PURSESTAKINGTREASURY_ADDRESS
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const purseStakingTreasuryAddressAfter = await stakePurseVault.purseStakingTreasury();
            expect(purseStakingTreasuryAddressAfter).to.equal(originalAddress);
        });

        it("updateVestDuration updates vestDuration correctly", async () => {
            const originalVestDuration = await stakePurseVault.vestDuration();
            const tx1 = await stakePurseVault.connect(owner).updateVestDuration(BigInt(1));
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vestDurationUpdated = await stakePurseVault.vestDuration();
            expect(vestDurationUpdated).to.equal(BigInt(1));

            const tx2 = await stakePurseVault.connect(owner).updateVestDuration(
                VEST_DURATION_AMOUNT
            );
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vestDurationAfter = await stakePurseVault.vestDuration();
            expect(vestDurationAfter).to.equal(originalVestDuration);
        });
    });

    describe("Functionality:", function () {
        it("stakePurse stakes user's initial stake and updates contract correctly (stake < min compound amount)", async () => {
            await expect(
                stakePurseVault.connect(owner).stakePurse(0)
            ).to.be.revertedWith("StakePurseVault: Cannot stake 0");

            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];

            const stakeAmount = BigInt(100 * 10 ** 18);
            const tx1 = await stakePurseVault.connect(owner).stakePurse(stakeAmount);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            await helpers.time.increase(86400 / 2); //forward 1/2 day

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];

            //Because user first deposit and very first deposit in vault,
            //vaultCRPT and userPrevCRPT should be the same.
            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultClaimableRewardAfter).to.be.gt(vaultClaimableRewardBefore);
            expect(userPurseBalanceAfter).to.equal(userPurseBalanceBefore - stakeAmount);
            expect(userStPurseBalanceAfter).to.be.gt(userStPurseBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gt(vaultRewardTokenBalanceBefore);
            //expect(vaultCRPTAfter).to.equal(vaultCRPTBefore); Only if its the vaults very first stake
            //expect(userPrevCRPTAfter).to.equal(userPrevCRPTBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore); //This is expected if its not the very first stake
            expect(userPrevCRPTAfter).to.be.gt(userPrevCRPTBefore); //Also expected since its not the very first stake
            expect(userClaimableRewardAfter).to.be.gt(userClaimableRewardBefore);
        });

        //Run this test case together with the previous test to simulate continuity
        it("Forwarding time reflects correct changes in vault", async () => {
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userClaimableRewardsBefore = await stakePurseVault.claimable(owner.address);
            await helpers.time.increase(864000); //forward 10 days
            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userClaimableRewardsAfter = await stakePurseVault.claimable(owner.address);

            expect(vaultTotalAssetAfter).to.equal(vaultTotalAssetBefore);
            expect(vaultClaimableRewardAfter).to.be.gt(vaultClaimableRewardBefore);
            expect(userClaimableRewardsAfter).to.be.gt(userClaimableRewardsBefore);
        });

        //Run this test case together with the previous test case to simulate same user staking twice
        it("stakePurse stakes user's second stake and updates contract correctly (stake < min compound amount)", async () => {
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            const stakeAmount = BigInt(100 * 10 ** 18);
            const tx1 = await stakePurseVault.connect(owner).stakePurse(stakeAmount);
            await tx1.wait();
            // await new Promise(r => setTimeout(r, 5000));

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultClaimableRewardAfter).to.be.gt(vaultClaimableRewardBefore);

            //Note: if reward token is PURSE, run this block
            //-----------------------------------------
            // expect(userPurseBalanceAfter).to.be.gt(
            //     userPurseBalanceBefore - stakeAmount + userClaimableRewardBefore
            // );
            // expect(userPurseBalanceAfter).to.be.lt(
            //     userPurseBalanceBefore - stakeAmount + userClaimableRewardBefore + BigInt(0.00001 * 10 ** 18)
            // );
            //-----------------------------------------
            //Otherwise, if reward token is not PURSE, run the following:
            //-----------------------------------------
            expect(userPurseBalanceAfter).to.equal(userPurseBalanceBefore - stakeAmount);
            expect(userVaultRewardTokenBalAfter).to.be.gt(userVaultRewardTokenBalBefore);
            //-----------------------------------------

            expect(userStPurseBalanceAfter).to.be.gt(userStPurseBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gte(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.be.gt(userPrevCRPTBefore);

            expect(userClaimableRewardAfter).to.be.lt(userClaimableRewardBefore);
            expect(userClaimableRewardAfter).to.equal(BigInt(0));
        });

        it("stakePurse stakes user's third stake and updates contract correctly, with compound", async () => {
            await helpers.time.increase(86400); //forward 1 day
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            const stakeAmount = MIN_COMPOUND_AMOUNT;
            const tx1 = await stakePurseVault.connect(owner).stakePurse(stakeAmount);
            await tx1.wait();

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore + stakeAmount);
            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore + stakeAmount + vaultClaimableRewardBefore);

            expect(vaultClaimableRewardAfter).to.be.lt(vaultClaimableRewardBefore);
            expect(vaultClaimableRewardAfter).to.equal(BigInt(0));

            expect(userPurseBalanceBefore).to.be.gt(userPurseBalanceAfter);
            //-----------------------------------------------------
            //If vault reward token is PURSE, run the following:
            // expect(userPurseBalanceAfter).to.be.gt(
            //     userPurseBalanceBefore - stakeAmount + userClaimableRewardBefore + BigInt(0.00001 * 10 ** 18)
            // );
            //Otherwise:
            expect(userPurseBalanceAfter).to.gt(userPurseBalanceBefore - stakeAmount);
            expect(userVaultRewardTokenBalAfter).to.be.gt(userVaultRewardTokenBalBefore);
            //-----------------------------------------------------

            expect(userStPurseBalanceAfter).to.be.gt(userStPurseBalanceBefore);

            expect(vaultTreasuryBalanceAfter).to.be.gt(vaultTreasuryBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gte(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.be.gt(userPrevCRPTBefore);

            expect(userClaimableRewardAfter).to.be.lt(userClaimableRewardBefore);
            expect(userClaimableRewardAfter).to.equal(BigInt(0));
        });

        it("Compounds updates the contract correctly", async () => {
            await helpers.time.increase(86400); //forward 1 day
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            const tx1 = await stakePurseVault.connect(owner).compound();
            await tx1.wait();

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore + vaultClaimableRewardBefore);

            expect(userVaultRewardTokenBalAfter).to.equal(userVaultRewardTokenBalBefore);

            expect(vaultClaimableRewardAfter).to.be.lt(vaultClaimableRewardBefore);
            expect(vaultClaimableRewardAfter).to.equal(BigInt(0));

            expect(userPurseBalanceBefore).to.be.lt(userPurseBalanceAfter);
            expect(userStPurseBalanceAfter).to.equal(userStPurseBalanceBefore);
            expect(vaultTreasuryBalanceAfter).to.be.gt(vaultTreasuryBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.equal(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.equal(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.equal(userPrevCRPTBefore);
            expect(userClaimableRewardAfter).to.be.gt(userClaimableRewardBefore);
        });

        it("unstakePurse unstakes some of user's stake and updates contract correctly", async () => {
            await helpers.time.increase(864000); //forward 10 days
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            const unstakeAmount = BigInt(100 * 10 ** 18); //unstake 100 PURSE shares
            const returnedAssetAmount = await stakePurseVault.previewRedeem(unstakeAmount);
            const tx1 = await stakePurseVault.connect(owner).unstakePurse(unstakeAmount);
            await tx1.wait();

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore - returnedAssetAmount);
            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore - returnedAssetAmount + vaultClaimableRewardBefore);

            expect(vaultClaimableRewardAfter).to.be.lt(vaultClaimableRewardBefore);
            expect(vaultClaimableRewardAfter).to.equal(BigInt(0));

            expect(userPurseBalanceAfter).to.be.gt(userPurseBalanceBefore);
            //-----------------------------------------------------
            //If vault reward token is PURSE, run the following:
            // expect(userPurseBalanceAfter).to.be.gt(
            //     userPurseBalanceBefore + userClaimableRewardBefore + (vaultClaimableRewardBefore) * BigInt("10") / BIPS_DIVISOR,
            // );
            // expect(userPurseBalanceAfter).to.be.lt(
            //     userPurseBalanceBefore + userClaimableRewardBefore + (vaultClaimableRewardBefore) * BigInt("20") / BIPS_DIVISOR,
            // );
            //Otherwise:
            expect(userPurseBalanceAfter).to.be.gt(
                userPurseBalanceBefore + (vaultClaimableRewardBefore) * BigInt("10") / BIPS_DIVISOR,
            );
            expect(userPurseBalanceAfter).to.be.lt(
                userPurseBalanceBefore + (vaultClaimableRewardBefore) * BigInt("20") / BIPS_DIVISOR,
            );
            expect(userVaultRewardTokenBalAfter).to.be.gt(userVaultRewardTokenBalBefore);
            //-----------------------------------------------------

            expect(userStPurseBalanceAfter).to.be.lt(userStPurseBalanceBefore);
            expect(userStPurseBalanceAfter).to.equal(userStPurseBalanceBefore - unstakeAmount);

            expect(vaultTreasuryBalanceAfter).to.be.gt(vaultTreasuryBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gte(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.gt(userPrevCRPTBefore);

            expect(userClaimableRewardAfter).to.be.lt(userClaimableRewardBefore);
            expect(userClaimableRewardAfter).to.equal(BigInt(0));
        });

        it("stakePurse for a second user stakes into the system and updates the contract correctly", async () => {
            await helpers.time.increase(86400); //forward 1 days
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(userB.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(userB.address);
            const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(userB.address);
            const userInfoBefore = await stakePurseVault.userInfo(userB.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(userB.address);

            const stakeAmount = MIN_COMPOUND_AMOUNT;
            const tx1 = await stakePurseVault.connect(userB).stakePurse(stakeAmount);
            await tx1.wait();

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(userB.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(userB.address);
            const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(userB.address);
            const userInfoAfter = await stakePurseVault.userInfo(userB.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(userB.address);

            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore);
            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore + stakeAmount);
            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore + stakeAmount + vaultClaimableRewardBefore);

            expect(vaultClaimableRewardAfter).to.be.lt(vaultClaimableRewardBefore);
            expect(vaultClaimableRewardAfter).to.equal(BigInt(0));

            expect(userPurseBalanceBefore).to.be.gt(userPurseBalanceAfter);
            expect(userPurseBalanceAfter).to.be.gt(
                userPurseBalanceBefore - stakeAmount + userClaimableRewardBefore + BigInt(0.00001 * 10 ** 18)
            );

            expect(userStPurseBalanceAfter).to.be.gt(userStPurseBalanceBefore);

            expect(vaultTreasuryBalanceAfter).to.be.gt(vaultTreasuryBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gte(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.be.gt(userPrevCRPTBefore);

            expect(userClaimableRewardAfter).to.equal(userClaimableRewardBefore);
            expect(userClaimableRewardAfter).to.equal(BigInt(0));

            //forward by a few days and check that userClaimable rewards increases
            await helpers.time.increase(86400 * 5); //forward 5 days

            const userClaimableRewardForwarded = await stakePurseVault.claimable(userB.address);
            expect(userClaimableRewardForwarded).to.be.gt(userClaimableRewardAfter);

            expect(userVaultRewardTokenBalAfter).to.be.equal(userVaultRewardTokenBalBefore);
        });

        it("unstakePurse unstakes all of first user's stake and updates contract correctly", async () => {
            await helpers.time.increase(1); //forward 1 days
            const vaultTotalAssetBefore = await stakePurseVault.totalAssets();
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceBefore = await purse.balanceOf(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceBefore = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoBefore = await stakePurseVault.vaultInfo();
            const vaultCRPTBefore = vaultInfoBefore[4];
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            const unstakeAmount = userStPurseBalanceBefore; //unstake ALL PURSE shares
            const returnedAssetAmount = await stakePurseVault.previewRedeem(unstakeAmount);
            const tx1 = await stakePurseVault.connect(owner).unstakePurse(unstakeAmount);
            await tx1.wait();

            const vaultTotalAssetAfter = await stakePurseVault.totalAssets();
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userPurseBalanceAfter = await purse.balanceOf(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const vaultTreasuryBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);
            const vaultRewardTokenBalanceAfter = await rewardDistributorRewardToken.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const vaultInfoAfter = await stakePurseVault.vaultInfo();
            const vaultCRPTAfter = await vaultInfoAfter[4];
            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(owner.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore);
            expect(vaultTotalAssetAfter).to.be.gt(vaultTotalAssetBefore - returnedAssetAmount);
            expect(vaultTotalAssetAfter).to.be.lt(vaultTotalAssetBefore + vaultClaimableRewardBefore - returnedAssetAmount);

            expect(vaultClaimableRewardAfter).to.be.lt(vaultClaimableRewardBefore);
            expect(vaultClaimableRewardAfter).to.equal(BigInt(0));

            expect(userPurseBalanceAfter).to.be.gt(userPurseBalanceBefore);
            //-----------------------------------------------------
            //If vault reward token is PURSE, run the following:
            // expect(userPurseBalanceAfter).to.be.gt(
            //     userPurseBalanceBefore + userClaimableRewardBefore + (vaultClaimableRewardBefore) * BigInt("10") / BIPS_DIVISOR,
            // );
            // expect(userPurseBalanceAfter).to.be.lt(
            //     userPurseBalanceBefore + userClaimableRewardBefore + (vaultClaimableRewardBefore) * BigInt("20") / BIPS_DIVISOR,
            // );
            //Otherwise:
            expect(userPurseBalanceAfter).to.be.gt(
                userPurseBalanceBefore + (vaultClaimableRewardBefore) * BigInt("10") / BIPS_DIVISOR,
            );
            expect(userPurseBalanceAfter).to.be.lt(
                userPurseBalanceBefore + (vaultClaimableRewardBefore) * BigInt("20") / BIPS_DIVISOR,
            );
            expect(userVaultRewardTokenBalAfter).to.be.gt(userVaultRewardTokenBalBefore);
            //-----------------------------------------------------

            expect(userStPurseBalanceAfter).to.be.lt(userStPurseBalanceBefore);
            expect(userStPurseBalanceAfter).to.equal(BigInt(0));

            expect(vaultTreasuryBalanceAfter).to.be.gt(vaultTreasuryBalanceBefore);
            expect(vaultRewardTokenBalanceAfter).to.be.gte(vaultRewardTokenBalanceBefore);
            expect(vaultCRPTAfter).to.be.gt(vaultCRPTBefore);
            expect(userPrevCRPTAfter).to.gt(userPrevCRPTBefore);

            expect(userClaimableRewardAfter).to.be.lt(userClaimableRewardBefore);
            expect(userClaimableRewardAfter).to.equal(BigInt(0));
        });

        it("A user without a stake in the vault should not have any accumulating rewards", async () => {
            const userClaimableRewardBefore = await stakePurseVault.claimable(owner.address);
            const userStPurseBalanceBefore = await stakePurseVault.balanceOf(owner.address);
            const userInfoBefore = await stakePurseVault.userInfo(userB.address);
            const userPrevCRPTBefore = userInfoBefore[1];
            const vaultClaimableRewardBefore = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userVaultRewardTokenBalBefore = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(userClaimableRewardBefore).to.equal(BigInt(0));
            expect(userStPurseBalanceBefore).to.equal(BigInt(0));

            await helpers.time.increase(864000); //forward 10 days

            const userClaimableRewardAfter = await stakePurseVault.claimable(owner.address);
            const userStPurseBalanceAfter = await stakePurseVault.balanceOf(owner.address);
            const userInfoAfter = await stakePurseVault.userInfo(userB.address);
            const userPrevCRPTAfter = userInfoAfter[1];
            const vaultClaimableRewardAfter = await purseStaking.previewClaimableRewards(STAKEPURSEVAULT_ADDRESS)
            const userVaultRewardTokenBalAfter = await rewardDistributorRewardToken.balanceOf(owner.address);

            expect(userClaimableRewardAfter).to.equal(BigInt(0));
            expect(userVaultRewardTokenBalAfter).to.equal(userVaultRewardTokenBalBefore);
            expect(userStPurseBalanceAfter).to.equal(BigInt(0));
            expect(userPrevCRPTAfter).to.equal(userPrevCRPTBefore);
            expect(vaultClaimableRewardAfter).to.be.gt(vaultClaimableRewardBefore);
        });

        it("recoverToken should recover the correct amount of tokens", async () => {
            const vaultPurseBalanceBefore = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const ownerPurseBalanceBefore = await purse.balanceOf(owner.address);

            const tx1 = await stakePurseVault.connect(owner).recoverToken(PURSE_ADDRESS, BigInt(100 * 10 ** 18), owner.address);
            await tx1.wait();

            const vaultPurseBalanceAfter = await purse.balanceOf(STAKEPURSEVAULT_ADDRESS);
            const ownerPurseBalanceAfter = await purse.balanceOf(owner.address);

            expect(vaultPurseBalanceAfter).to.equal(vaultPurseBalanceBefore - BigInt(100 * 10 ** 18));
            expect(ownerPurseBalanceAfter).to.equal(ownerPurseBalanceBefore + BigInt(100 * 10 ** 18));
        });

        it("recoverToken cannot have zero values for token and recipient", async () => {
            await expect(
                stakePurseVault.connect(owner).recoverToken(ZEROADDRESS, BigInt(0), owner.address)
            ).to.be.revertedWith("StakePurseVault: Token zero address");

            await expect(
                stakePurseVault.connect(owner).recoverToken(PURSE_ADDRESS, BigInt(0), ZEROADDRESS)
            ).to.be.revertedWith("StakePurseVault: Recipient zero address");
        });
    });
});