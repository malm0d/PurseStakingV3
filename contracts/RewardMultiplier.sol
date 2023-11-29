// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

interface IRewarder {
    function onReward(address user, uint256 rewardAmount) external;
}

contract PurseRewardMultiplier is IRewarder, Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //storage variables
    address private MASTER_CHEF;

    // IERC20Upgradeable[] public rewardTokens;
    // uint256[] public rewardMultipliers;

    //Can we use this struct to optimize gas?
    //Occupies each struct in the array occupies 32 bytes nicely
    struct RewardInfo {
        address rewardToken; //20bytes == 160bits
        uint96 rewardMultiplier; //96 bits
    }
    RewardInfo[] public rewardInfo;

    //can this below be removed? We can use decimals from ERC20 to calc divisor
    uint256 private BASE_REWARD_TOKEN_DIVISOR;

    //can this nested mapping be optimized to a single mapping?
    //If the reward token is solely PURSE, we can use single mapping.
    mapping(address => mapping(uint256 => uint256)) private rewardDebts;

    event Reward(address indexed _user);
    event RewardTokenAdded(address indexed _token, uint256 indexed _multiplier);
    event MultiplierUpdated(uint256 indexed _pid, uint256 indexed _multiplier);
    event ReturnToken(address indexed _token, address indexed _to, uint256 _amount);

    function initialize(
        address _masterChef,
        uint256 _baseRewardTokenDecimal,
        address _rewardToken,
        uint96 _multiplier
    ) public initializer {
        MASTER_CHEF = _masterChef;
        BASE_REWARD_TOKEN_DIVISOR = 10 ** _baseRewardTokenDecimal;
        RewardInfo memory initialRewardInfo = RewardInfo({
            rewardToken: _rewardToken,
            rewardMultiplier: _multiplier
        });
        rewardInfo.push(initialRewardInfo);
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

    function onReward(address _user, uint256 _rewardAmount) external override whenNotPaused {
        require(msg.sender == MASTER_CHEF, "PurseRewardMultiplier: only callable by masterchef");
        require(_user != address(0), "PurseRewardMultiplier: zero address");
        uint256 rewardInfoLength = rewardInfo.length;
        for (uint256 i = 0; i < rewardInfoLength;) {
            RewardInfo memory _rewardInfo = rewardInfo[i];
            address rewardToken = _rewardInfo.rewardToken;
            uint256 pendingReward = 
                rewardDebts[_user][i] + 
                ((_rewardAmount * _rewardInfo.rewardMultiplier) / BASE_REWARD_TOKEN_DIVISOR);
            uint256 rewardBalance = IERC20Upgradeable(rewardToken).balanceOf(address(this));

            if (pendingReward > rewardBalance) {
                rewardDebts[_user][i] = pendingReward - rewardBalance;
                IERC20Upgradeable(rewardToken).safeTransfer(_user, rewardBalance);
            } else {
                rewardDebts[_user][i] = 0;
                IERC20Upgradeable(rewardToken).safeTransfer(_user, pendingReward);
            }

            unchecked {
                i++;
            }
        }
        emit Reward(_user);
    }

    function returnToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "PurseRewardMultiplier: zero address");
        require(_amount > 0, "PurseRewardMultiplier: zero amount");
        IERC20Upgradeable(_token).safeTransfer(_to, _amount);

        emit ReturnToken(_token, _to, _amount);
    }

    function pendingTokens(
        address _user,
        uint256 _rewardAmount
    ) external view returns (address[] memory, uint256[] memory) {
        uint256 rewardInfoLength = rewardInfo.length;
        address[] memory tokens = new address[](rewardInfoLength);
        uint256[] memory amounts = new uint256[](rewardInfoLength);
        for (uint256 i = 0; i < rewardInfoLength;) {
            RewardInfo memory _rewardInfo = rewardInfo[i];
            uint256 pendingReward = 
                rewardDebts[_user][i] + 
                ((_rewardAmount * _rewardInfo.rewardMultiplier) / BASE_REWARD_TOKEN_DIVISOR);
            uint256 rewardBalance = IERC20Upgradeable(_rewardInfo.rewardToken).balanceOf(address(this));

            tokens[i] = _rewardInfo.rewardToken;
            if (pendingReward > rewardBalance) {
                amounts[i] = rewardBalance;
            } else {
                amounts[i] = pendingReward;
            }

            unchecked {
                i++;
            }
        }
        return (tokens, amounts);
    }

    function getRewardInfo(uint256 _pid) external view returns (address, uint96) {
        return (rewardInfo[_pid].rewardToken, rewardInfo[_pid].rewardMultiplier);
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }
}