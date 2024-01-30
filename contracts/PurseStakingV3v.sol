// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { IRewardDistributor } from "./interfaces/IRewardDistributor.sol";
import { ITreasury } from "./interfaces/ITreasury.sol";
import { IPurseStakingVesting } from "./interfaces/IPurseStakingVesting.sol";

interface IPurseToken {

    function transfer(address to, uint tokens) external returns (bool success);

    function transferFrom(address from, address to, uint tokens) external returns (bool success);

    function balanceOf(address tokenOwner) external view returns (uint balance);

}

contract PurseStakingV3v is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    string public name;
    IPurseToken public purseToken;
    uint256 private _totalReceiptSupply;
       
    struct UserInfo {
        uint256 receiptToken;
        uint256 newReceiptToken;
        uint256 withdrawReward;
        uint256 lockTime;
        uint256 claimableReward;
        uint256 previousCumulatedRewardPerToken;
    }

    mapping (address => UserInfo) public userInfo;

    uint256 private _totalLockedAmount;
    uint256 public lockPeriod;

    uint256 public cumulativeRewardPerToken;
    address public distributor;
    address public treasury;
    address public vesting;

    // function initialize(IPurseToken _purseToken) public initializer {
    //     purseToken = _purseToken;
    //     name = "Purse Staking";
    //     __Pausable_init();
    //     __Ownable_init();
    //     __UUPSUpgradeable_init();
    // }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    event Deposit(address indexed _from, uint256 _value);
    event WithdrawUnlockedStake(address indexed _from, uint256 _value);
    event WithdrawLockedStake(address indexed _from, uint256 _value);
    event UpdateRewards(
        address indexed _address, 
        uint256 indexed _userRewards, 
        uint256 indexed _userClaimableRewards
    );
    event UpdateUserClaimed(address indexed _address, uint256 indexed _amount);
    event DisributorChanged(address indexed _address);
    event TreasuryChanged(address indexed _address);
    event VestingChanged(address indexed _address);
    event SendVestedPurse(uint256 safeAmount);

    function enter(uint256 purseAmount) external whenNotPaused returns (uint256) {
        require(purseToken.balanceOf(msg.sender) >= purseAmount, "Insufficient Purse Token");

        uint256 totalXPurse = totalReceiptSupply();
        uint256 totalPurse = availablePurseSupply();

        _updateRewards(msg.sender);

        purseToken.transferFrom(msg.sender, address(this), purseAmount);
        uint256 receiptAmount;
        if (totalXPurse <= 0 || totalPurse <= 0) {
            require(totalXPurse <= 0, "Total Receipt > 0");
            userInfo[msg.sender].newReceiptToken = purseAmount;
            _totalReceiptSupply += purseAmount;
            receiptAmount = purseAmount;
        }
        else {
            receiptAmount = purseAmount.mul(totalXPurse).div(totalPurse);
            userInfo[msg.sender].newReceiptToken += receiptAmount;
            _totalReceiptSupply += receiptAmount;
        }

        emit Deposit(msg.sender, purseAmount);
        return receiptAmount;
    }

    function leave(uint256 xPurseAmount) external whenNotPaused returns (uint256){
        UserInfo storage user = userInfo[msg.sender];
        uint256 userReceipt = userReceiptToken(msg.sender);
        uint256 totalXPurse = totalReceiptSupply();
        uint256 totalPurse = availablePurseSupply();
        uint256 purseAmount;
        uint256 purseReward;
        require(userReceipt >= xPurseAmount, "Insufficient Receipt Token");

        _updateRewards(msg.sender);
        if (user.withdrawReward > 0) {
            _migrateLockedAmount();
        }

        if(user.receiptToken <= 0) {
            purseReward = xPurseAmount.mul(totalPurse).div(totalXPurse);
            user.newReceiptToken -= xPurseAmount;
            handleReceipt(purseReward);
        } else {
            if(xPurseAmount > user.receiptToken) {
                uint256 newReceipt = xPurseAmount.sub(user.receiptToken);
                purseReward = newReceipt.mul(totalPurse).div(totalXPurse);
                purseAmount = user.receiptToken.mul(totalPurse).div(totalXPurse);
                user.newReceiptToken -= newReceipt;
                user.receiptToken = 0;
                handleReceipt(purseReward);
            } else {
                purseAmount = xPurseAmount.mul(totalPurse).div(totalXPurse);
                user.receiptToken -= xPurseAmount;
            }
            uint256 purseTransfer = safePurseTransfer(purseAmount);
            emit WithdrawUnlockedStake(msg.sender, purseTransfer);
            purseToken.transfer(msg.sender, purseTransfer);
        }
        _totalReceiptSupply -= xPurseAmount;

        return purseReward;
    }

    function handleReceipt(uint256 _purseReward) internal {
        IPurseStakingVesting(vesting).lockWithEndTime(
            msg.sender,
            _purseReward,
            block.timestamp.add(lockPeriod) //endTime
        );
        purseToken.transfer(vesting, _purseReward);
        emit SendVestedPurse(_purseReward);
    }

    function _migrateLockedAmount() internal whenNotPaused returns (bool success){
        UserInfo storage user = userInfo[msg.sender];
        uint256 lockEndTime = user.lockTime.add(lockPeriod);
        uint256 lockReward = user.withdrawReward;

        _totalLockedAmount -= user.withdrawReward;
        user.withdrawReward = 0;
        user.lockTime = 0;

        IPurseStakingVesting(vesting).lockWithEndTime(
            msg.sender,
            lockReward,
            lockEndTime //endTime
        );
        purseToken.transfer(vesting, lockReward);
        return true;
    }

    function updateLockPeriod(uint256 newLockPeriod) external onlyOwner {
        require(newLockPeriod != lockPeriod, "Same as Previous Lock Period");
        lockPeriod = newLockPeriod;
    }

    function withdrawLockedAmount() public whenNotPaused returns (bool success){
        UserInfo storage user = userInfo[msg.sender];
        uint256 lockDuration = block.timestamp.sub(user.lockTime); 
        require(user.withdrawReward > 0, "Insufficient Withdrawal Amount");
        require(lockDuration >= lockPeriod && user.lockTime != 0, "Lock Time < Lock Period and/or Lock Time == 0");

        uint256 purseTransfer = safePurseTransfer(user.withdrawReward);
        _totalLockedAmount -= user.withdrawReward;
        user.withdrawReward = 0;
        user.lockTime = 0;

        emit WithdrawLockedStake(msg.sender, purseTransfer);
        purseToken.transfer(msg.sender, purseTransfer);
        return true;
    }

    function safePurseTransfer(uint256 amount) internal view returns (uint256) {
        uint256 totalPurse = availablePurseSupply();
        return amount > totalPurse ? totalPurse : amount;
    }

    function getTotalPurse(address purseOwner) external view returns (uint256){  
        uint256 totalXPurse = totalReceiptSupply();
        uint256 totalPurse = availablePurseSupply();
        uint256 userReceipt = userReceiptToken(purseOwner);
        uint256 purseAmount = userReceipt.mul(totalPurse).div(totalXPurse);
        return purseAmount;
    }

    function userReceiptToken(address purseOwner) public view returns (uint256) {
        return userInfo[purseOwner].receiptToken.add(userInfo[purseOwner].newReceiptToken);
    }

    function totalLockedAmount() public view returns (uint256) {
        return _totalLockedAmount;
    }

    function availablePurseSupply() public view returns (uint256) {
        return purseToken.balanceOf(address(this)).sub(totalLockedAmount());
    }

    function totalReceiptSupply() public view returns (uint256) {
        return _totalReceiptSupply;
    }

    function recoverToken(address tokenAddress, uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "Send to Zero Address");
        IERC20Upgradeable(tokenAddress).safeTransfer(recipient, amount);
    }
    
    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    /**
     * @notice Updates the claimable rewards for the given account.
     * @param _account address of the account to update rewards for.
     * @dev Calls the distributor contract to distribute rewards to the treasury.
     * Then calculates the contract's cumulative reward per token, and
     * calculates the account's claimable rewards based on the account's shares
     * and prev cumulated reward per token. If called by the distributor through
     * updateRewards, only updates the cumulative reward per token in the state.
     */
    function _updateRewards(address _account) private {
        uint256 blockRewards = IRewardDistributor(distributor).distribute();
        uint256 supply = totalReceiptSupply();
        uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken;
        if (supply > 0 && blockRewards > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken.add(
                blockRewards.mul(1e18).div(supply)
            );
            cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }

        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            UserInfo storage user = userInfo[_account];
            uint256 userRewards = userReceiptToken(_account).mul(
                _cumulativeRewardPerToken.sub(user.previousCumulatedRewardPerToken)
            ).div(1e18);
            uint256 userClaimableReward = user.claimableReward.add(userRewards);
            user.claimableReward = userClaimableReward;
            user.previousCumulatedRewardPerToken = _cumulativeRewardPerToken;

            if (userClaimableReward > 0) {
                emit UpdateRewards(_account, userRewards, userClaimableReward);
            }
        }
    }
    /**
     * @notice Updates and returns the claimable rewards for the given account.
     * @param _account address of the account to update claimable rewards.
     * @dev Calls _updateRewards to update the account's claimable rewards in the state.
     * Then, returns the account's claimable rewards from the state.
     */
    function updateClaim(address _account) external returns (uint256) {
        require(msg.sender == treasury, "PurseStakingV3: msg.sender is not the treasury");

        uint256 treasuryBalance = IERC20Upgradeable(rewardToken()).balanceOf(treasury);
        require(treasuryBalance > 0, "PurseStakingV3: treasury has no rewards available");

        _updateRewards(_account);
        UserInfo storage user = userInfo[_account];
        uint256 claimableAmount = user.claimableReward;
        require(claimableAmount > 0, "PurseStakingV3: user does not have available rewards");

        user.claimableReward = 0;

        if (claimableAmount > treasuryBalance) {
            claimableAmount = treasuryBalance;
        }

        emit UpdateUserClaimed(_account, claimableAmount);
        return claimableAmount;
    }

    /**
     * @notice Called by the distributor contract when the tokens per interval is updated.
     * @dev Only callable by the distributor. When called by the distributor, only updates 
     * the cumulative reward per token in the state.
     */
    function updateRewards() external {
        require(msg.sender == distributor, "PurseStakingV3: msg.sender is not the distributor");
        _updateRewards(address(0));
    }

    /**
     * @notice Updates the reward distributor contract address.
     * @param _distributor address of the new reward distributor contract.
     * @dev Only callable by the owner.
     */
    function updateDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
        emit DisributorChanged(_distributor);
    }

    /**
     * @notice Updates the treasury contract address.
     * @param _treasury address of the new treasury contract.
     * @dev Only callable by the owner.
     */
    function updateTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryChanged(_treasury);
    }

    /**
     * @notice Updates the vesting contract address.
     * @param _vesting address of the new vesting contract.
     * @dev Only callable by the owner.
     */
    function updateVesting(address _vesting) external onlyOwner {
        vesting = _vesting;
        emit VestingChanged(_vesting);
    }

    /**
     * @notice Previews the claimable rewards for the given address.
     * @param _address address of the account to preview claimable rewards for.
     * @dev The user's estimated claimable rewards at the time of the call.
     */
    function previewClaimableRewards(address _address) external view returns (uint256) {
        UserInfo storage user = userInfo[_address];
        uint256 blockRewards = IRewardDistributor(distributor).previewDistribute();
        uint256 supply = totalReceiptSupply();
        uint256 cumulativeRewardPerTokenSnap = cumulativeRewardPerToken;
        if (supply > 0 && blockRewards > 0) {
            cumulativeRewardPerTokenSnap = cumulativeRewardPerTokenSnap.add(
                blockRewards.mul(1e18).div(supply)
            );
        }
        uint256 userClaimableReward = user.claimableReward;
        
        if (userReceiptToken(_address) > 0) {
            uint256 userRewards = userReceiptToken(_address).mul(
                cumulativeRewardPerTokenSnap.sub(user.previousCumulatedRewardPerToken)
            ).div(1e18);
            userClaimableReward = userClaimableReward.add(userRewards);
        }
        return userClaimableReward;
    }

    /**
     * @notice Previews the cumulative reward per token for the contract and the
     * previous cumulated reward per token for the given address
     * @param _address The address of the account to preview for.
     */
    function getCumulativeRewardPerToken(address _address) external view returns (uint256, uint256) {
        UserInfo storage user = userInfo[_address];
        return (cumulativeRewardPerToken, user.previousCumulatedRewardPerToken);
    }

    /**
     * @notice Gets the current reward token address.
     */
    function rewardToken() public view returns (address) {
        return IRewardDistributor(distributor).rewardToken();
    }
}