// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import {IStakePurseVault} from "../interfaces/IStakePurseVault.sol";
import {Governable} from "../Governable.sol";

//--------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------
//********DO NOT USE THIS CONTRACT - DEPRECATED in favor for Multi Reward Distributor design********
//--------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------

contract VaultRewardDistributor is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, Governable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public rewardToken;
    uint256 public tokensPerInterval;
    uint256 public lastDistributionTime;
    address public rewardTracker; //vault

    event Distribute(uint256 amount);
    event LastDistributionTimeUpdated(uint256 timestamp);
    event TokensPerIntervalChange(uint256 amount);
    event RewardTrackerUpdated(address indexed _address);
    event RecoverToken(address indexed _token, address indexed _to, uint256 indexed _amount);

    function initialize(
        address _rewardToken, 
        address _rewardTracker, 
        address _owner, 
        address _governor
    ) public initializer {
        rewardToken = _rewardToken;
        rewardTracker = _rewardTracker;
        
        __Governable_init(_owner, _governor);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {} 

    /**
     * @notice Distribute block rewards to the vault.
     * @dev Only callable by the rewardTracker (vault). Also returns the amount distributed.
     */
    function distribute() external returns (uint256) {
        require(msg.sender == rewardTracker, "VaultRewardDistributor: msg.sender is not the rewardTracker");
        uint256 amount = pendingRewards();
        if (amount == 0) {
            return 0;
        }

        lastDistributionTime = block.timestamp;
        uint256 balance = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        if (amount > balance) {
            amount = balance;
        }
        IERC20Upgradeable(rewardToken).safeTransfer(msg.sender, amount);

        emit Distribute(amount);
        return amount;
    }

    /**
     * @notice Calculates the amount of rewards that have accumulated since the 
     * last distribution time.
     */
    function pendingRewards() public view returns (uint256) {
        if (block.timestamp == lastDistributionTime) {
            return 0;
        }
        uint256 timeDifference = block.timestamp.sub(lastDistributionTime);
        return tokensPerInterval.mul(timeDifference);
    }

    /**
     * @notice Updates the lastDistributionTime to the current block timestamp.
     * @dev Only callable by the governor.
     * Should always be called before `setTokensPerInterval`.
     */
    function updateLastDistributionTime() external onlyRole(GOVERNOR_ROLE) {
        lastDistributionTime = block.timestamp;

        emit LastDistributionTimeUpdated(block.timestamp);
    }

    /**
     * @notice Sets the amount of tokens to distribute per interval.
     * @param _amount The amount (wei) of tokens to distribute per interval.
     * @dev Only callable by the governor.
     */
    function setTokensPerInterval(uint256 _amount) external onlyRole(GOVERNOR_ROLE) {
        require(lastDistributionTime != 0, "RewardDistributor: lastDistributionTime is not set");
        IStakePurseVault(rewardTracker).updateRewards();
        tokensPerInterval = _amount;
        
        emit TokensPerIntervalChange(_amount);
    }

    /**
     * @notice Recovers ERC20 tokens sent to this contract.
     * @param _token The address of the token to recover.
     * @param _amount The amount of tokens to recover.
     * @param _recipient The address to send the tokens to.
     * @dev Only callable by the owner.
     */
    function recoverToken(address _token, uint256 _amount, address _recipient) external onlyRole(OWNER_ROLE) {
        require(_recipient != address(0), "RewardDistributor: Send to Zero Address");
        IERC20Upgradeable(_token).safeTransfer(_recipient, _amount);

        emit RecoverToken(_token, _recipient, _amount);
    }

    /**
     * @notice Updates the rewardTracker contract address.
     * @param _rewardTracker The address of the rewardTracker contract.
     * @dev Only callable by the owner. This should be the Purse Staking contract.
     */
    function updateRewardTracker(address _rewardTracker) external onlyRole(OWNER_ROLE) {
        require(_rewardTracker != address(0), "RewardDistributor: Zero Address");
        rewardTracker = _rewardTracker;
        
        emit RewardTrackerUpdated(_rewardTracker);
    }
}
