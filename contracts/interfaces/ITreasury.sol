// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITreasury {
    function updateUserAvailableRewards(address _address, uint256 _amount) external;
    function claimRewards(address _address) external returns (uint256);
}