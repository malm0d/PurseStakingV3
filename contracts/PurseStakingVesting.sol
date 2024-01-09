// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IPurseStakingV3} from "./interfaces/IPurseStakingV3.sol";

///@dev Vesting contract for PurseStaking

contract PurseStakingVesting is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    
    using SafeERC20Upgradeable for IERC20Upgradeable;
    //testnet: 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141
    //mainnet: 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
    address public constant PURSE = 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141;
    address private purseStaking;

    ///@dev vestedQuantity is the amount of tokens that have been vested and are available to the user
    struct VestingSchedule {
        uint128 startTime;
        uint128 endTime;
        uint256 quantity;
        uint256 vestedQuantity;
    }

    ///@dev accountVestingSchedules: mapping of user addresses to their vesting schedules 
    mapping(address => VestingSchedule[]) private accountVestingSchedules;

    ///@dev accountEscrowedBalance: mapping of user addresses to the amount of tokens that are currently escrowed
    mapping(address => uint256) public accountEscrowedBalance;

    ///@dev accountVestedBalance: mapping of user addresses to the amount of tokens that have been vested for the user
    mapping(address => uint256) public accountVestedBalance;

    event VestingEntryCreated(address indexed beneficiary, uint256 startTime, uint256 endTime, uint256 quantity);
    event Vested(address indexed beneficiary, uint256 vestedQuantity, uint256 index);
    event CompleteVesting(address indexed beneficiary, uint256 indexed totalVesting);
    event UpdatePurseStaking(address indexed purseStaking);
    event UpdatePurseStakingTreasury(address indexed purseStakingTreasury); //KIV
    event RecoverToken(address indexed token, address indexed recipient, uint256 amount);

    modifier onlyPurseStaking() {
        require(msg.sender == purseStaking, "Only PurseStaking can call");
        _;
    }

    function initialize(address _purseStaking) public initializer {
        purseStaking = _purseStaking;

        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**************************************** View Functions ****************************************/

    ///@notice Returns the total number of vesting schedules for a user
    function numVestingSchedules(address account) external view returns (uint256) {
        return accountVestingSchedules[account].length;
    }

    ///@notice Gets the vesting schedule at a given index for a user
    function getVestingScheduleAtIndex(address account, uint256 index) external view returns (VestingSchedule memory) {
        return accountVestingSchedules[account][index];
    }

    ///@notice Gets all vesting schedules for a user
    function getVestingSchedules(address account) external view returns (VestingSchedule[] memory) {
        return accountVestingSchedules[account];
    }

    function getPurseStaking() external view returns (address) {
        return purseStaking;
    }

    /**************************************** Core Functions ****************************************/

    /**
     * @dev Allows a user to vest all vesting schedule that have ended
     */
    function vestCompletedSchedules() public nonReentrant returns (uint256) {
        uint256 totalVesting = 0;
        totalVesting = _vestCompletedSchedules();
        return totalVesting;
    }

    /**
     * @dev Allows a user to vest all vesting schedule that have ended.
     * Processes vesting schedules that have ended, and calculates the total amount of tokens to be vested.
     * Emits a `Vested` event for each schedule that has been vested (completed).
     */
    function _vestCompletedSchedules() internal returns (uint256) {
        VestingSchedule[] storage schedules = accountVestingSchedules[msg.sender];
        uint256 schedulesLength = schedules.length;

        uint256 totalVesting = 0; //Total amount of tokens to be vested

        for (uint256 i = 0; i < schedulesLength;) {
            VestingSchedule memory schedule = schedules[i];
            // If the schedule has ended, vest the remaining tokens in schedule if any
            if (_getBlockTime() >= schedule.endTime) {
                uint256 vestQuantity = schedule.quantity - schedule.vestedQuantity;
                if (vestQuantity > 0) {
                    // Update the vesting schedule to reflect the newly vested tokens
                    schedules[i].vestedQuantity = schedule.quantity;
                    totalVesting = totalVesting + vestQuantity;

                    emit Vested(msg.sender, vestQuantity, i);
                }
            }
            unchecked {
                i++;
            }
        }
        _completeVesting(totalVesting);
        _clearClaimedSchedule();
        return totalVesting;
    }

    /**
     * @param totalVesting total amount of tokens to be vested
     * @dev Completes the vesting process by transferring the vested tokens to the user.
     * Updates the user's escrowed and vested balances.
     */
    function _completeVesting(uint256 totalVesting) internal {
        require(totalVesting > 0, "No tokens to vest");

        accountEscrowedBalance[msg.sender] = accountEscrowedBalance[msg.sender] - totalVesting;
        accountVestedBalance[msg.sender] = accountVestedBalance[msg.sender] + totalVesting;

        uint256 purseStakingLiquidity = IPurseStakingV3(purseStaking).availablePurseSupply();
        require(purseStakingLiquidity >= totalVesting, "PurseStakingVesting: insufficient liquidity in system");

        IPurseStakingV3(purseStaking).sendVestedPurse(totalVesting);
        IERC20Upgradeable(PURSE).safeTransfer(msg.sender, totalVesting);

        emit CompleteVesting(msg.sender, totalVesting);
    }
    
    /**
     * @dev Removes vesting schedules that have ended and have been fully vested.
     *  Breaks as soon as we find a schedule that is not fully vested.
     * `index` will be the index of the schedule that is not fully vested.
     */
    function _clearClaimedSchedule() internal {
        VestingSchedule[] storage schedules = accountVestingSchedules[msg.sender];
        uint256 schedulesLength = schedules.length;
        uint256 index;

        for (index = 0; index < schedulesLength; index++) {
            VestingSchedule memory schedule = schedules[index];
            uint256 vestQuantity = schedule.quantity - schedule.vestedQuantity;
            if (vestQuantity == 0) {
                continue;
            } else {
                break;
            }
        }

        if (index != 0) {
            //shift non-fully vested schedules toward beginning of array, replacing fully vested schedules.
            for (uint256 i = 0; i < schedulesLength - index;) {
                schedules[i] = schedules[i + index];
                unchecked { i++; }
            }
            //pop the duplicated schedules at the end of the array, thereby reducing the
            //array length to reflect removal of fully vested schedules.
            for (uint256 i = 0; i < index;) {
                schedules.pop();
                unchecked { i++; }
            }
        }
    }
    
    function _getBlockTime() internal virtual view returns (uint128) {
        return uint128(block.timestamp);
    }

    /**************************************** Only Authorised Functions ****************************************/

    function lockWithEndTime(address account, uint256 quantity, uint256 endTime) external onlyPurseStaking {
        require(quantity > 0, "Quantity cannot be 0");

        VestingSchedule[] storage schedules = accountVestingSchedules[account];

        //append new vesting schedule
        schedules.push(VestingSchedule({
            startTime: uint128(block.timestamp),
            endTime: uint128(endTime),
            quantity: quantity,
            vestedQuantity: 0
        }));

        //record the amount of tokens that are escrowed (vesting balance) for the user
        accountEscrowedBalance[account] = accountEscrowedBalance[account] + quantity;

        emit VestingEntryCreated(account, block.timestamp, endTime, quantity);
    }

    function updatePurseStaking(address _purseStaking) external onlyOwner {
        purseStaking = _purseStaking;
        emit UpdatePurseStaking(_purseStaking);
    }

    function recoverToken(address token, uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "Cannot transfer to zero address");
        require(token != address(0), "Token cannot be zero address");
        IERC20Upgradeable(token).safeTransfer(recipient, amount);
        emit RecoverToken(token, recipient, amount);
    }
}