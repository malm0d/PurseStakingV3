// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IPurseStakingV3 } from "./interfaces/IPurseStakingV3.sol";
import { IRewardDistributor } from "./interfaces/IRewardDistributor.sol";

contract Treasury is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    //0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
    address public constant PURSE = 0x8b9AF6F11b3A7Ad35F2FA4899c9Ce1d8F7cC9579;
    address public PURSE_STAKING;
    address public DISTRIBUTOR;
    

    event UpdateUserAvailableRewards(address indexed _address, uint256 indexed _amount, uint256 indexed _timestamp);
    event Claimed(address indexed _address, uint256 indexed _amount, uint256 indexed _timestamp);
    event ReturnToken(address indexed _token, address indexed _to, uint256 indexed _amount);

    function initialize(address _purseStaking, address _distributor) public initializer {
        PURSE_STAKING = _purseStaking;
        DISTRIBUTOR = _distributor;
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @notice Updates the Purse Staking contract address.
     * @param _address The address of the Purse Staking contract.
     * @dev Only callable by the owner.
     */
    function updatePurseStaking(address _address) external onlyOwner {
        require(_address != address(0), "Treasury: zero address");
        PURSE_STAKING = _address;
    }

    /**
     * @notice Updates the Reward Distributor contract address.
     * @param _address The address of the Reward Distributor contract.
     * @dev Only callable by the owner.
     */
    function updateDistributor(address _address) external onlyOwner {
        require(_address != address(0), "Treasury: zero address");
        DISTRIBUTOR = _address;
    }

    /**
     * @notice Allows the user to claim their available rewards.
     * @param _address The address of the user to claim rewards.
     * @dev Sends a call to the staking contract to get the user's available rewards.
     * Reverts if the treasury has no rewards, the user does not have available
     * rewards, the address is the zero address, when the contract is paused.
     */
    function claimRewards(address _address) external whenNotPaused {
        require(_address != address(0), "Treasury: zero address");
        uint256 userClaimableAmount = IPurseStakingV3(PURSE_STAKING).getUserClaimableRewards(_address);
        IERC20Upgradeable(PURSE).safeTransfer(_address, userClaimableAmount);

        emit Claimed(_address, userClaimableAmount, block.timestamp);
    }

    /**
     * @notice Recovers tokens from the contract.
     * @param _token The address of the token to return.
     * @param _to The address to return the tokens to.
     * @param _amount The amount of tokens to return.
     */
    function returnToken(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Treasury: zero address");
        require(_amount > 0, "Treasury: zero amount");
        IERC20Upgradeable(_token).safeTransfer(_to, _amount);

        emit ReturnToken(_token, _to, _amount);
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }
}