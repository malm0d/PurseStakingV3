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
    address public rewardTracker;
    address public treasury;

    event Distribute(uint256 indexed amount);
    event TokensPerIntervalChange(uint256 indexed amount);

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

    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {} 

    /**
     * @notice Distribute block rewards to the treasury contract.
     * @dev Only callable by the rewardTracker. Also returns the amount distributed.
     */
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

    /**
     * @notice Calculates the amount of rewards that have accumulated since the 
     * last distribution time.
     */
    function pendingRewards() public view override returns (uint256) {
        if (block.timestamp == lastDistributionTime) {
            return 0;
        }
        uint256 timeDifference = block.timestamp.sub(lastDistributionTime);
        return tokensPerInterval.mul(timeDifference);
    }

    /**
     * @notice Updates the lastDistributionTime to the current block timestamp.
     * @dev Only callable by the governor.
     */
    function updateLastDistributionTime() external onlyRole(GOVERNOR_ROLE) {
        lastDistributionTime = block.timestamp;
    }

    /**
     * @notice Sets the amount of tokens to distribute per interval.
     * @param _amount The amount (wei) of tokens to distribute per interval.
     * @dev Only callable by the governor.
     */
    function setTokensPerInterval(uint256 _amount) external onlyRole(GOVERNOR_ROLE) {
        require(lastDistributionTime != 0, "RewardDistributor: lastDistributionTime is not set");
        tokensPerInterval = _amount;
        IPurseStakingV3(rewardTracker).updateRewards();
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
    }

    /**
     * @notice Updates the treasury contract address.
     * @param _treasury The address of the treasury contract.
     * @dev Only callable by the owner.
     */
    function updateTreasury(address _treasury) external onlyRole(OWNER_ROLE) {
        require(_treasury != address(0), "RewardDistributor: Zero Address");
        treasury = _treasury;
    }

    /**
     * @notice Updates the rewardTracker contract address.
     * @param _rewardTracker The address of the rewardTracker contract.
     * @dev Only callable by the owner. This should be the Purse Staking contract.
     */
    function updateRewardTracker(address _rewardTracker) external onlyRole(OWNER_ROLE) {
        require(_rewardTracker != address(0), "RewardDistributor: Zero Address");
        rewardTracker = _rewardTracker;
    }

    /**
     * @notice Previews the amount of tokens that are available to be distributed
     * when the next distribution is called by the rewardTracker contract.
     */
    function previewDistribute() external view returns (uint256) {
        uint256 amount = pendingRewards();
        if (amount == 0) {
            return 0;
        }
        uint256 balance = IERC20Upgradeable(rewardToken).balanceOf(address(this));
        if (amount > balance) {
            amount = balance;
        }
        return amount;
    }
    
}