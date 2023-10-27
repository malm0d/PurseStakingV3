// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Governable } from "./Governable.sol";
import { IRewardDistributor } from "./interfaces/IRewardDistributor.sol";
import { IPurseStakingV3 } from "./interfaces/IPurseStakingV3.sol";

contract RewardDistributor is Initializable, UUPSUpgradeable, IRewardDistributor, ReentrancyGuardUpgradeable, Governable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public override rewardToken;
    uint256 public override tokensPerInterval;
    uint256 public lastDistributionTime;
    address public rewardTracker; //PurseStakingV3
    address public treasury;

    event Distribute(uint256 amount);
    event TokensPerIntervalChange(uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _rewardToken, 
        address _rewardTracker, 
        address _treasury, 
        address _owner, 
        address _governor
    ) public initializer {
        rewardToken = _rewardToken;
        rewardTracker = _rewardTracker;
        treasury = _treasury;
        
        __Governable_init(_owner, _governor);
        __UUPSUpgradeable_init();
    }

    function distribute() external override returns (uint256) {
        require(msg.sender == rewardTracker, "RewardDistributor: msg.sender is not the rewardTracker");
        uint256 amount = pendingRewards();
        if (amount == 0) {
            return 0;
        }
        
        lastDistributionTime = block.timestamp;
        uint256 balance = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        if (amount > balance) {
            amount = balance;
        }
        IERC20Upgradeable(rewardToken).safeTransfer(treasury, amount);

        emit Distribute(amount);
        return amount;
    }

    function pendingRewards() public view override returns (uint256) {
        if (block.timestamp == lastDistributionTime) {
            return 0;
        }
        uint256 timeDifference = block.timestamp.sub(lastDistributionTime);
        return tokensPerInterval.mul(timeDifference);
    }

    function updateLastDistributionTime() external onlyRole(GOVERNOR_ROLE) {
        lastDistributionTime = block.timestamp;
    }

    function setTokensPerInterval(uint256 _amount) external onlyRole(GOVERNOR_ROLE) {
        require(lastDistributionTime != 0, "RewardDistributor: lastDistributionTime is not set");
        IPurseStakingV3(rewardTracker).updateRewards();
        tokensPerInterval = _amount;
        emit TokensPerIntervalChange(_amount);
    }

    function recoverToken(address _token, uint256 _amount, address _recipient) external onlyRole(OWNER_ROLE) {
        require(_recipient != address(0), "RewardDistributor: Send to Zero Address");
        IERC20Upgradeable(_token).safeTransfer(_recipient, _amount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {} 
}