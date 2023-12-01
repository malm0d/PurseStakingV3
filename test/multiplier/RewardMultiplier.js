const { assert, expect } = require("chai");
require("dotenv").config();
const hre = require("hardhat");
const MASTER_CHEF_ABI = require("../MasterChef.json");
const PURSE_ABI = require("../Purse.json");
const WFX_ABI = require("../WFX_Upgradeable.json");

describe("RewardMultiplierTest", function () {
    const REWARD_MULTIPLIER = "PurseRewardMultiplier";

    const REWARD_MULTIPLIER_ADDRESS_TESTNET = "";
    const WFX_ADDRESS_TESTNET = "0x3452e23F9c4cC62c70B7ADAd699B264AF3549C19";
    const PURSE_ADDRESS_TESTNET = "0xc8B4d3e67238e38B20d38908646fF6F4F48De5EC";
    const MASTERCHEF_ADDRESS_TESTNET = "0x3Af307F9f14d7641320Bb3cf6bb4A14A740EdEec";

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
            REWARD_MULTIPLIER_ADDRESS_TESTNET,
            owner
        );

        Purse = await hre.ethers.getContractAt(
            PURSE_ABI,
            PURSE_ADDRESS_TESTNET,
            owner
        );

        WFX = await hre.ethers.getContractAt(
            WFX_ABI,
            WFX_ADDRESS_TESTNET,
            owner
        );

        MasterChef = await hre.ethers.getContractAt(
            MASTER_CHEF_ABI,
            MASTERCHEF_ADDRESS_TESTNET,
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