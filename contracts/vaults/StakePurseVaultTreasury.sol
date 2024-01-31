// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IStakePurseVaultVesting} from "../interfaces/IStakePurseVaultVesting.sol";

///@dev FeeTreasury for StakePurseVault

contract StakePurseVaultTreasury is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
    address public constant PURSE = 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141;
    address public stakePurseVaultVesting;

    event SendVestedPurse(uint256 safeAmount);
    event StakePurseVaultVestingChanged(address indexed newAddress);
    event RecoverToken(address indexed token, address indexed recipient, uint256 amount);

    modifier onlyVestedPurse() {
        require(msg.sender == stakePurseVaultVesting, "Only StakePurseVaultVesting can call");
        _;
    }

    function initialize() external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Sends PURSE to StakePurseVaultVesting contract.
     * Only callable by StakePurseVaultVesting contract. 
     */
    function sendVestedPurse(uint256 safeAmount) external onlyVestedPurse {
        IERC20Upgradeable(PURSE).safeTransfer(stakePurseVaultVesting, safeAmount);
        emit SendVestedPurse(safeAmount);
    }

    function updateVestedPurse(address _vestedPurse) external onlyOwner {
        require(_vestedPurse != address(0), "StakePurseVaultTreasury: zero address");
        stakePurseVaultVesting = _vestedPurse;
        emit StakePurseVaultVestingChanged(_vestedPurse);
    }

    function recoverToken(address token, address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "VaultTreasury: Recipient zero address");
        require(token != address(0), "VaultTreasury: Token zero address");
        IERC20Upgradeable(token).safeTransfer(recipient, amount);
        emit RecoverToken(token, recipient, amount);
    }
}