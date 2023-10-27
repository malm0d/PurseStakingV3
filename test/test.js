const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const BEP20ABI = require("./BEP20.json");
require("dotenv").config();

//npx hardhat test test/test.js --network bsctestnet
describe("Test", function () {
    const purseStakingAddress = "0x1e4Dc34f66Be83D863006086128B7259cf3AD0eD";
    let owner;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
    });

    it("PurseStakingV2", async () => {

        token = await hre.ethers.getContractAt(
            BEP20ABI,
            "0xE81165fCDD0336A0f219cF8235D6287Bd0f9f752",
            owner
        );

        purseStaking = await hre.ethers.getContractAt(
            "PurseStakingV2",
            purseStakingAddress,
            owner
        );
        const info = await purseStaking.userInfo(owner.address);
        console.log("User A: " + info);
        const info2 = await purseStaking.userInfo("0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966")
        console.log("User B: " + info2);
        const info3 = await purseStaking.userInfo("0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D")
        console.log("User C: " + info3);

        const rtA = await purseStaking.userReceiptToken(owner.address);
        console.log("User A Receipt Tokens: " + rtA);
        const rtB = await purseStaking.userReceiptToken("0xAbCCf019ce52e7DEac396D1f1A1D9087EBF97966");
        console.log("User B Receipt Tokens: " + rtB);
        const rtC = await purseStaking.userReceiptToken("0x9d356F4DD857fFeF5B5d48DCf30eE4d9574d708D");
        console.log("User C Receipt Tokens: " + rtC);


        const availablePurseSupply = await purseStaking.availablePurseSupply();
        const totalReceiptSupply = await purseStaking.totalReceiptSupply();
        const totalLockedAmount = await purseStaking.totalLockedAmount();
        console.log("Total Available Purse: " + availablePurseSupply)
        console.log("Total receiptSupply: " + totalReceiptSupply)
        console.log("Total locked amount: " + totalLockedAmount);

        const balance = await token.balanceOf(purseStakingAddress)
        console.log("Contract Balance: " + balance)
    })
})