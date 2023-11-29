const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const ERC20ABI = require("../ERC20.json");

describe("RewardMultiplierTest", function () {
    const REWARD_MULTIPLIER = "PurseRewardMultiplier";
    const REWARD_TOKEN = "SOME";
    const MASTER_CHEF = "0xSomeChef";

    const REWARD_MULTIPLIER_ADDRESS = "0xSomeMultiplier";
    const REWARD_TOKEN_ADDRESS = "0xSOME";
    const MASTER_CHEF_ADDRESS = "0xSomeChef";

    let owner;
    let user1;
    let user2;
    let RewardMultiplier;
    let RewardToken;
    let MasterChef;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        user1 = signers[1];
        user2 = signers[2];

        RewardMultiplier = await hre.ethers.getContractAt(
            REWARD_MULTIPLIER,
            REWARD_MULTIPLIER_ADDRESS,
            owner
        );

        RewardToken = await hre.ethers.getContractAt(
            ERC20ABI,
            REWARD_TOKEN_ADDRESS,
            owner
        );

        MasterChef = await hre.ethers.getContractAt(
            MASTER_CHEF,
            MASTER_CHEF_ADDRESS,
            owner
        );
    })

    describe("Check access for functions", function () {
        it("Non owner cannot call addRewardToken", async () => { });

        it("Non owner cannot call removeRewardToken", async () => { });

        it("Non owner cannot call updateMultiplier", async () => { });

        it("Non MasterChef address cannot call onReward", async () => { });

        it("Non owner cannot call returnToken", async () => { });
    });

    describe("Test addRewardToken", function () { });

    describe("Test removeRewardToken", function () { });

    describe("Test updateMultiplier", function () { });

    describe("Test returnToken", function () { });

    describe("Test onReward", function () { });


});