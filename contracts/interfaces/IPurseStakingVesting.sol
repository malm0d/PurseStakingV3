// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IPurseStakingVesting {
    struct VestingSchedule {
        uint128 startTime;
        uint128 endTime;
        uint256 quantity;
        uint256 vestedQuantity;
    }

    function lockWithEndTime(address account, uint256 quantity, uint256 endTime) external;

    function getVestingSchedules(address account) external view returns (VestingSchedule[] memory);

    function accountEscrowedBalance(address account) external view returns (uint256);

    function accountVestedBalance(address account) external view returns (uint256);

    function vestCompletedSchedules() external returns (uint256);
}