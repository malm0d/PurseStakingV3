// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IRewarder {
    function onReward(address user, uint256 rewardAmount) external;
}

contract PurseRewardMultiplier is IRewarder, Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //storage variables
    address private MASTER_CHEF;
    IERC20Upgradeable[] public rewardTokens;
    uint256[] public rewardMultipliers;

    //Can we use this struct to optimize gas?
    //Occupies 32 bytes nicely, per struct
    struct RewardInfo {
        address rewardToken;
        uint96 rewardMultiplier;
    }
    RewardInfo[] public rewardInfo;

    //can this below be removed? We can use decimals from ERC20 to calc divisor
    uint256 private BASE_REWARD_TOKEN_DIVISOR;

    //can this nested mapping be optimized to a single mapping?
    //If the reward token is solely PURSE, we can use single mapping
    mapping(address => mapping(uint256 => uint256)) private rewardDebts;

    event Reward(address indexed _user);
    event RewardTokenAdded(address indexed _token, uint256 indexed _multiplier);
    event MultiplierUpdated(uint256 indexed _pid, uint256 indexed _multiplier);
    event ReturnToken(address indexed _token, address indexed _to, uint256 _amount);

    function initialize(
        address _masterChef,
        address _owner,
        address _governor
    ) public initializer {
        MASTER_CHEF = _masterChef;
        //some

        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function addRewardToken(address _token, uint96 _multiplier) external onlyOwner {
        require(_token != address(0), "PurseRewardMultiplier: cannot add zero address");
        require(_multiplier > 0, "PurseRewardMultiplier: cannot add zero multiplier");
        require(_multiplier <= type(uint96).max, "PurseRewardMultiplier: multiplier too large");

        RewardInfo memory newRewardInfo = RewardInfo({
            rewardToken: _token,
            rewardMultiplier: _multiplier
        });
        rewardInfo.push(newRewardInfo);

        emit RewardTokenAdded(_token, _multiplier);
    }

    function updateMultiplier(uint256 _pid, uint96 _multiplier) external onlyOwner {
        require(_multiplier > 0, "PurseRewardMultiplier: cannot add zero multiplier");
        require(_multiplier <= type(uint96).max, "PurseRewardMultiplier: multiplier too large");

        RewardInfo storage rewardInfoToUpdate = rewardInfo[_pid];
        rewardInfoToUpdate.rewardMultiplier = _multiplier;

        emit MultiplierUpdated(_pid, _multiplier);
    }

    function onReward(address _user, uint256 _rewardAmount) external override {
        require(msg.sender == MASTER_CHEF, "PurseRewardMultiplier: only callable by masterchef");
        //some
    }

    function returnToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "PurseRewardMultiplier: zero address");
        require(_amount > 0, "PurseRewardMultiplier: zero amount");
        IERC20Upgradeable(_token).safeTransfer(_to, _amount);

        emit ReturnToken(_token, _to, _amount);
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    function pendingTokens(
        address _user,
        uint256 _rewardAmount
    ) external view returns (address[] memory, uint256[] memory) {

    }

    function getRewardInfo(uint256 _pid) external view returns (address, uint96) {
        return (rewardInfo[_pid].rewardToken, rewardInfo[_pid].rewardMultiplier);
    }

    // function getRewardTokens() external view returns (IERC20Upgradeable[] memory) {
    //     return rewardTokens;
    // }

    // function getRewardMultipliers() external view returns (uint256[] memory) {
    //     return rewardMultipliers;
    // }
}