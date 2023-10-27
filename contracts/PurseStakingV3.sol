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

    address public distributor;
    uint256 public cumulativeRewardPerToken;
    address public treasury;

    //need to set distributor and treasury
    function initialize(IPurseToken _purseToken) public initializer {
        purseToken = _purseToken;
        name = "Purse Staking";
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    event Deposit(address indexed _from, uint256 _value);
    event WithdrawUnlockedStake(address indexed _from, uint256 _value);
    event WithdrawLockedStake(address indexed _from, uint256 _value);
    event Claim(address indexed _receiver, uint256 indexed _value);
    event DisributorChanged(address indexed _address);

    function enter(uint256 purseAmount) external whenNotPaused returns (bool success) {
        require(purseToken.balanceOf(msg.sender) >= purseAmount, "Insufficient Purse Token");
        
        //add stake function from stfxvault
        require(purseAmount > 0, "Amount must be greater than 0");
        _claim(msg.sender, msg.sender);

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

    //new
    //stake and unstake calls _claim
    //_claim in turn calls _updateRewards
    //no need _stake or _unstake (as they are only relevant to delegations)

    /**
     * @notice Updates the claimable rewards for the given account
     * @param _account address of the account to update rewards for
     * @dev Calls the distributor contract to distribute rewards to the treasury.
     * Then calcultates the cumulative reward per token by taking the current block rewards / total PURSE shares, 
     * which is then used to calculate claimable rewards for the account.
     */
    function _updateRewards(address _account) private {
        uint256 blockRewards = IRewardDistributor(distributor).distribute();
        uint256 receiptSupply = totalReceiptSupply();
        uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken;
        if (receiptSupply > 0 && blockRewards > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken.add(blockRewards.mul(1e18).div(receiptSupply));
            cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }

        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            UserInfo storage user = userInfo[_account];
            uint256 userRewards = user.receiptToken.mul(_cumulativeRewardPerToken.sub(user.previousCumulatedRewardPerToken)).div(1e18);
            uint256 userClaimableReward = user.claimableReward.add(userRewards);
            user.claimableReward = userClaimableReward;
            user.previousCumulatedRewardPerToken = _cumulativeRewardPerToken;
        }
    }

    function _claim(address _account, address _receiver) private returns (uint256) {
        _updateRewards(_account);
        UserInfo storage user = userInfo[_account];
        uint256 tokenAmount = user.claimableReward;
        user.claimableReward = 0;

        if (tokenAmount > 0) {
            //IERC20Upgradeable(rewardToken()).safeTransfer(_receiver, tokenAmount);

            //this tokenAmount should be transfered to the recipient by the treasury contract
            //as the block rewards are distributed there.
            //This function should call should function in the treasury contract to update the claimable rewards
            //for each user, as we are giving them the liberty to claim their rewards whenever they want.

            emit Claim(_receiver, tokenAmount);
        }
        return tokenAmount;
    }

    

    function updateRewards() external {
        require(msg.sender == distributor, "PurseStakingV3: msg.sender is not the distributor");
        _updateRewards(address(0));
    }

    function claim(address receiver) external returns (uint256) {
        require(msg.sender == treasury, "PurseStakingV3: msg.sender is not the treasury");
        return _claim(msg.sender, receiver);
    }

    function rewardToken() public view returns (address) {
        return IRewardDistributor(distributor).rewardToken();
    }

    function updateDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
        emit DisributorChanged(_distributor);
    }
}