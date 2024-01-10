// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IStakePurseVault {
    function sendVestedPurse(uint256 safeAmount) external;
    function updateRewards() external;
}