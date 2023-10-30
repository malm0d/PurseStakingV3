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

    address public constant PURSE = 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C;
    address public PURSE_STAKING;
    address public DISTRIBUTOR;
    mapping(address => uint256) public userAvailableRewards;

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

    function updatePurseStaking(address _address) external onlyOwner {
        require(_address != address(0), "Treasury: zero address");
        PURSE_STAKING = _address;
    }

    function updateUserAvailableRewards(address _address, uint256 _amount) external {
        require(msg.sender == PURSE_STAKING, "Treasury: only PURSE_STAKING");
        userAvailableRewards[_address] = _amount;

        emit UpdateUserAvailableRewards(_address, _amount, block.timestamp);
    }

    function claimRewards(address _address) external {
        require(_address != address(0), "Treasury: zero address");

        uint256 userClaimableAmount = userAvailableRewards[_address];
        require(userClaimableAmount > 0, "Treasury: User does not have available rewards");

        userAvailableRewards[_address] = 0;
        IPurseStakingV3(PURSE_STAKING).updateUserClaimed(_address);
        IERC20Upgradeable(PURSE).safeTransfer(_address, userClaimableAmount);

        emit Claimed(_address, userClaimableAmount, block.timestamp);
    }

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