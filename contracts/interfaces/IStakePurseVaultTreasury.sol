// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IStakePurseVaultTreasury {
    function sendVestedPurse(uint256 safeAmount) external;
}