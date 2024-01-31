const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const PURSE_BSC_ABI = require("../../abis/PurseBsc.json");
require("dotenv").config();
const helpers = require("@nomicfoundation/hardhat-network-helpers");

//Tests for StakePurseVaultTreasury contract

//Testnet: npx hardhat test test/vault/StakePurseVaultTreasury.js --network bsctestnet
//Forked: npx hardhat test test/vault/StakePurseVaultTreasury.js --network hardhat
describe("StakePurseVaultTreasury Tests", function () {
    const PURSE_ADDRESS = "0xC1ba0436DACDa5aF5A061a57687c60eE478c4141";
    const STAKEPURSEVAULTTREASURY_ADDRESS = "0xb45D05ed99168c7BC21C5120642cC235b5331da8";
    const STAKEPURSEVAULTVESTING_ADDRESS = "0x1cddE3BB0DaF9Def56F7e5e5B8BfDFd6689160A7";

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    let owner;
    let userB;

    let purse;
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

        stakePurseVaultTreasury = await hre.ethers.getContractAt(
            "StakePurseVaultTreasury",
            STAKEPURSEVAULTTREASURY_ADDRESS,
            owner
        );
    });

    describe("Pre-conditions:", function () {
        it("StakePurseVaultTreasury has the correct vesting contract address", async () => {
            const vaultVestingAddress = await stakePurseVaultTreasury.stakePurseVaultVesting();
            assert.equal(vaultVestingAddress, STAKEPURSEVAULTVESTING_ADDRESS);
        });
    });

    describe("Access control:", function () {
        it("sendVestedPurse cannot be called by non StakePurseVaultVesting", async () => {
            await expect(
                stakePurseVaultTreasury.connect(owner).sendVestedPurse(1000)
            ).to.be.revertedWith("Only StakePurseVaultVesting can call");
        });

        it("updateVestedPurse cannot be called by non owner", async () => {
            await expect(
                stakePurseVaultTreasury.connect(userB).updateVestedPurse(ZEROADDRESS)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("recoverToken cannot be called by non owner", async () => {
            await expect(
                stakePurseVaultTreasury.connect(userB).recoverToken(PURSE_ADDRESS, userB.address, BigInt(1000))
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Update contract addresses:", function () {
        it("updatedVestedPurse updates stakePurseVaultVesting variable correctly", async () => {
            const tx1 = await stakePurseVaultTreasury.connect(owner).updateVestedPurse(userB.address);
            await tx1.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultVestingAddress1 = await stakePurseVaultTreasury.stakePurseVaultVesting();
            expect(vaultVestingAddress1).to.equal(userB.address);
            const tx2 = await stakePurseVaultTreasury.connect(owner).updateVestedPurse(STAKEPURSEVAULTVESTING_ADDRESS);
            await tx2.wait();
            await new Promise(r => setTimeout(r, 5000));
            const vaultVestingAddress2 = await stakePurseVaultTreasury.stakePurseVaultVesting();
            expect(vaultVestingAddress2).to.equal(STAKEPURSEVAULTVESTING_ADDRESS);
        });
    });

    describe("Functionality:", function () {
        it("recoverToken should recover the correct amount of tokens", async () => {
            const userBalanceBefore = await purse.balanceOf(owner.address);
            const contractBalanceBefore = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);

            const tx = await purse.connect(owner).transfer(STAKEPURSEVAULTTREASURY_ADDRESS, BigInt(100));
            await tx.wait();
            await new Promise(r => setTimeout(r, 5000));

            const recoverTx = await stakePurseVaultTreasury.connect(owner).recoverToken(PURSE_ADDRESS, owner.address, BigInt(100));
            await recoverTx.wait();
            await new Promise(r => setTimeout(r, 5000));

            const userBalanceAfter = await purse.balanceOf(owner.address);
            const contractBalanceAfter = await purse.balanceOf(STAKEPURSEVAULTTREASURY_ADDRESS);

            expect(userBalanceAfter).to.equal(userBalanceBefore);
            expect(contractBalanceAfter).to.equal(contractBalanceBefore);
        });
    });


});