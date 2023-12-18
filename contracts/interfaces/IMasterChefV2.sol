// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMasterChefV2 {
    function userInfo(uint pid, address user) external view returns (
        uint256 amount,
        uint256 rewardDebt
    );

    function poolInfo(uint pid) external view returns (
        address lpToken,
        uint allocPoint,
        uint lastRewardBlock,
        uint accRewardPerShare
    );

    function rewarder(uint pid) external view returns (address);

    function pendingReward(uint256 _pid, address _user) external view returns (uint256);

    function deposit(uint256 pid, uint256 amount) external;

    function withdraw(uint256 pid, uint256 amount) external;

    function emergencyWithdraw(uint256 pid) external;
}