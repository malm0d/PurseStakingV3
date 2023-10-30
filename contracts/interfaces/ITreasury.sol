// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITreasury {
    function updateUserClaimableRewards(address _address, uint256 _amount) external;
}