// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { IRewardDistributor } from "./interfaces/IRewardDistributor.sol";
import { ITreasury } from "./interfaces/ITreasury.sol";

interface IPurseToken {

    function transfer(address to, uint tokens) external returns (bool success);

    function transferFrom(address from, address to, uint tokens) external returns (bool success);

    function balanceOf(address tokenOwner) external view returns (uint balance);

}

contract PurseStakingV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
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

    //need to set distributor and treasury
    function initialize(IPurseToken _purseToken, address _distributor, address _treasury) public initializer {
        purseToken = _purseToken;
        name = "Purse Staking";
        distributor = _distributor;
        treasury = _treasury;
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    event Deposit(address indexed _from, uint256 _value);
    event WithdrawUnlockedStake(address indexed _from, uint256 _value);
    event WithdrawLockedStake(address indexed _from, uint256 _value);
    event UpdateClaim(address indexed _receiver, uint256 indexed _value);
    event UpdateUserClaimed(address indexed _address);
    event DisributorChanged(address indexed _address);
    event TreasuryChanged(address indexed _address);

    function enter(uint256 purseAmount) external whenNotPaused returns (bool success) {
        require(purseToken.balanceOf(msg.sender) >= purseAmount, "Insufficient Purse Token");
        
        //add stake function from stfxvault
        require(purseAmount > 0, "Amount must be greater than 0");
        _updateClaim(msg.sender, msg.sender);

        uint256 totalXPurse = totalReceiptSupply();
        uint256 totalPurse = availablePurseSupply();

        purseToken.transferFrom(msg.sender, address(this), purseAmount);

        if (totalXPurse <= 0 || totalPurse <= 0) {
            require(totalXPurse <= 0, "Total Receipt > 0");
            userInfo[msg.sender].newReceiptToken = purseAmount;
            _totalReceiptSupply += purseAmount;
        }
        else {
            uint256 newReceipt = purseAmount.mul(totalXPurse).div(totalPurse);
            userInfo[msg.sender].newReceiptToken += newReceipt;
            _totalReceiptSupply += newReceipt;
        }

        //_updateClaim should be here?

        emit Deposit(msg.sender, purseAmount);
        return true;
    }

    function leave(uint256 xPurseAmount) external whenNotPaused returns (bool success){
        UserInfo storage user = userInfo[msg.sender];
        uint256 userReceipt = userReceiptToken(msg.sender);
        uint256 totalXPurse = totalReceiptSupply();
        uint256 totalPurse = availablePurseSupply();
        uint256 purseAmount;
        uint256 purseReward;
        require(userReceipt >= xPurseAmount, "Insufficient Receipt Token");

        if(user.receiptToken <= 0) {
            uint256 lockDuration = block.timestamp.sub(user.lockTime); 
            if (lockDuration >= lockPeriod && user.lockTime != 0) {
                withdrawLockedAmount();
            }
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
        //do some logic here to update the rewards when user unstakes
        return true;
    }

    function handleReceipt(uint256 _purseReward) internal {
        UserInfo storage user = userInfo[msg.sender];             
        user.withdrawReward += _purseReward;
        user.lockTime = block.timestamp;
        _totalLockedAmount += _purseReward;
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

    /****************************************V3 new functions****************************************
    //TO DO: stake and unstake calls _claim
    //TO DO: add a rewardsPreview function to see how much rewards a user will get
    //TO DO: Should the claimable rewards be based on shares or supply?

    /**
     * @notice Updates the claimable rewards for the given account.
     * @param _account address of the account to update rewards for.
     * @dev Calls the distributor contract to distribute rewards to the treasury.
     * Next, calculates the cumulative reward per token by taking the current block 
     * rewards / available PURSE supply. Then, calculates the account's claimable rewards 
     * based on the account's shares and prev cumulated reward per token.
     * If called by the distributor through updateRewards, only updates the cumulative 
     * reward per token in the state.
     */
    function _updateRewards(address _account) private {
        uint256 blockRewards = IRewardDistributor(distributor).distribute();
        uint256 supply = availablePurseSupply();
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
            uint256 userRewards = userReceiptToken(_account).mul(_cumulativeRewardPerToken.sub(user.previousCumulatedRewardPerToken)).div(1e18);
            uint256 userClaimableReward = user.claimableReward.add(userRewards);
            user.claimableReward = userClaimableReward;
            user.previousCumulatedRewardPerToken = _cumulativeRewardPerToken;
        }
    }
    /**
     * @notice Returns the claimable rewards for the given account.
     * @param _account address of the account to get claimable rewards for.
     * @param _receiver address of the account to receive the claimable rewards.
     * @dev Calls _updateRewards to update the account's claimable rewards in the state.
     * Then, extracts the account's claimable rewards from the state and if its more than zero,
     * calls the treasury contract to update the account's claimable rewards in the treasury for 
     * the user to claim from the treasury
     */
    function _updateClaim(address _account, address _receiver) private returns (uint256) {
        _updateRewards(_account);
        UserInfo storage user = userInfo[_account];
        uint256 tokenAmount = user.claimableReward;
        //user.claimableReward = 0; //this will be done in the treasury when the user claims

        if (tokenAmount > 0) {
            ITreasury(treasury).updateUserAvailableRewards(_receiver, tokenAmount);
            emit UpdateClaim(_receiver, tokenAmount);
        }
        return tokenAmount;
    }

    /**
     * @notice Called by the distributor when the tokens per interval is updated to update the cumulative
     * reward per token in the state.
     * @dev When called by the distributor, only updates the cumulative reward per token 
     * in the state.
     */
    function updateRewards() external {
        require(msg.sender == distributor, "PurseStakingV3: msg.sender is not the distributor");
        _updateRewards(address(0));
    }

    /**
     * @notice Called by the treasury when a user claims their rewards to reset their claimable rewards 
     * to zero in the state.
     * @param _account address of the account to update claimable rewards to zero.
     * @dev When called by the treasury during a claimRewards call by a user, updates
     * the user's claimable rewards to zero in the state.
     */
    function updateUserClaimed(address _account) external {
        require(msg.sender == treasury, "PurseStakingV3: msg.sender is not the treasury");
        UserInfo storage user = userInfo[_account];
        user.claimableReward = 0;
        
        emit UpdateUserClaimed(_account);
    }

    function updateDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
        emit DisributorChanged(_distributor);
    }

    function updateTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryChanged(_treasury);
    }

    function previewClaimableRewards(address _address) external view returns (uint256) {
        UserInfo storage user = userInfo[_address];
        uint256 blockRewards = IRewardDistributor(distributor).previewDistribute();
        uint256 supply = availablePurseSupply();
        uint256 cumulativeRewardPerTokenSnap = cumulativeRewardPerToken;
        if (supply > 0 && blockRewards > 0) {
            cumulativeRewardPerTokenSnap = cumulativeRewardPerTokenSnap.add(
                blockRewards.mul(1e18).div(supply)
            );
        }
        uint256 userClaimableReward = user.claimableReward;
        
        if (userReceiptToken(_address) > 0) {
            uint256 userRewards = userReceiptToken(_address).mul(cumulativeRewardPerTokenSnap.sub(user.previousCumulatedRewardPerToken)).div(1e18);
            userClaimableReward = userClaimableReward.add(userRewards);
        }
        return userClaimableReward;
    }

    function getCumulativeRewardPerToken(address _address) external view returns (uint256, uint256) {
        UserInfo storage user = userInfo[_address];
        return (cumulativeRewardPerToken, user.previousCumulatedRewardPerToken);
    }

    function rewardToken() public view returns (address) {
        return IRewardDistributor(distributor).rewardToken();
    }
}