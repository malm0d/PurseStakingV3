// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPurseStakingV3 {
    function totalReceiptSupply() external view returns (uint256);
    function userReceiptToken(address purseOwner) external view returns (uint256);
    function updateRewards() external;
    function updateClaim(address _account) external returns (uint256);
    function getCumulativeRewardPerToken(address _address) external view returns (uint256, uint256);
    function previewClaimableRewards(address _address) external view returns (uint256);
    function enter(uint256 purseAmount) external returns (uint256);
    function leave(uint256 xPurseAmount) external returns (uint256);
    function availablePurseSupply() external view returns (uint256);
}