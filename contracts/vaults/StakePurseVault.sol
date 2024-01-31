// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import {BaseVault} from "./BaseVault.sol";
import {IStakePurseVaultVesting} from "../interfaces/IStakePurseVaultVesting.sol";
import {IVaultRewardDistributor} from "../interfaces/IVaultRewardDistributor.sol";
import {ITreasury} from "../interfaces/ITreasury.sol";
import {IPurseStakingV3} from "../interfaces/IPurseStakingV3.sol";
import {IPurseStakingVesting} from "../interfaces/IPurseStakingVesting.sol";

contract StakePurseVault is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, BaseVault {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using MathUpgradeable for uint256;

    //testnet: 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141
    //mainnet: 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C
    uint256 internal constant BIPS_DIVISOR = 10_000; //Basis points divisor (100%)
    uint256 internal constant PRECISION = 1e30; 
    address constant PURSE = 0xC1ba0436DACDa5aF5A061a57687c60eE478c4141;

    uint256 public vestDuration;
    address public stakePurseVaultVesting; //Vesting for StakePurseVault
    address public stakePurseVaultTreasury; //Treasury for StakePurseVault
    address public vaultRewardDistributor; //Multi Vault Reward Distributor

    address public purseStaking; //PurseStaking contract
    address public purseStakingTreasury; //PurseStaking Treasury

    uint256 public pendingPurseRewards; //Bal of Purse rewards in the contract pending compound

    uint256 public feeOnReward; //Compound reward: protocol fee
    uint256 public feeOnCompounder; //Compound reward: compounder fee
    uint256 public feeOnWithdrawal; //Withdrawal fee

    uint256 private MIN_COMPOUND_AMOUNT; //Minimum stake amount for compound to happen
    uint256 private CAP_STAKE_PURSE_TARGET; //Cap amount of staked Purse by Vault

    VaultInfo public vaultInfo;
    mapping(address => UserInfo) public userInfo;

    struct VaultInfo {
        uint256 stakeId;
        uint256 unstakeId;
        uint256 length;
        uint256 totalAllocPoint;
        uint256 cumulativeRewardPerToken;
    }

    struct UserInfo {
        uint256 claimableReward;
        uint256 previousCumulatedRewardPerToken;
    }

    address public purseStakingVesting; //PurseStakingVesting contract

    event Stake(address indexed user, uint256 amount, uint256 shares);
    event Unstake(address indexed user, uint256 amount, uint256 shared);
    event Compound(address indexed user, uint256 compoundAmount);
    event Claim(address indexed receiver, uint256 amount);
    event SendVestedPurse(uint256 safeAmount);
    event StakePurseVaultVestingChanged(address indexed newAddress);
    event StakePurseVaultTreasuryChanged(address indexed newAddress);
    event VaultRewardDistributorChanged(address indexed newAddress);
    event PurseStakingChanged(address indexed newAddress);
    event PurseStakingTreasuryChanged(address indexed newAddress);
    event ConfigsUpdated(uint256 minCompound, uint256 capStakePurse);
    event FeesUpdated(uint256 feeOnReward, uint256 feeOnCompounder, uint256 feeOnWithdrawal);
    event VestDurationUpdated(uint256 vestDuration);
    event PurseStakingVestingChanged(address indexed newAddress);
    event VaultVestedAmount(uint256 amount);

    modifier onlyVestedPurse() {
        require(msg.sender == stakePurseVaultVesting, "Only VestedPurse can call");
        _;
    }

    function initialize(
        address _assetToken,
        address _owner,
        address _governor
    ) public initializer {
        __BaseVaultInit(
            _assetToken,    //PURSE
            "Staked PURSE Token",
            "StPURSE",
            _owner,
            _governor
        );
        vestDuration = 21 days;
        __Governable_init(_owner, _governor);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {}

    /****************************************** Core External Functions ******************************************/

    /**
     * @notice Stake PURSE tokens to the vault
     * @param amount The amount of PURSE tokens to stake to vault
     * @dev Vault will stake to PurseStaking.
     * For compound to happen, `amount` must be greater than or equal to `MIN_COMPOUND_AMOUNT`
     */
    function stakePurse(uint256 amount) external whenNotPaused {
        require(amount > 0, "StakePurseVault: Cannot stake 0");
        uint256 _totalAssets = totalAssets(); //overriden impl of totalAssets (below)
        require(amount + _totalAssets <= CAP_STAKE_PURSE_TARGET, "StakePurseVault: Cap exceeded");

         //Compound rewards before stake
        if (amount >= MIN_COMPOUND_AMOUNT) {
            compound();
        }

        _claim(msg.sender, msg.sender); //Claim vault rewards (BAVA) for user

        IERC20Upgradeable(PURSE).safeTransferFrom(msg.sender, address(this), amount);

        //Purse token -> BRT2 shares
        uint256 shares = previewDeposit(amount);
        _mint(msg.sender, shares);
        _stake(amount); //stake to PurseStaking

        emit Stake(msg.sender, amount, shares);
    }

    /**
     * @notice Unstake PURSE tokens from the vault
     * @param amount The amount of PURSE tokens to unstake from vault
     * @dev After unstake, the withdrawn PURSE will be vested
     */
    function unstakePurse(uint256 amount) external whenNotPaused {
        require(amount > 0, "StakePurseVault: Cannot unstake 0");
        uint256 userSharesPreBurn = balanceOf(msg.sender);
        require(userSharesPreBurn >= amount, "StakePurseVault: Amount exceeds shares");

        compound();

        _claim(msg.sender, msg.sender); //Claim vault rewards (BAVA) for user
        
        //Expected Purse amount to withdraw
        //BRT2 shares -> Purse token amount
        uint256 withdrawAssetAmount = previewRedeem(amount);
        uint256 withdrawAssetAmountAfterFee = withdrawAssetAmount * (BIPS_DIVISOR - feeOnWithdrawal) / BIPS_DIVISOR;

        _burn(msg.sender, amount);

        if(withdrawAssetAmountAfterFee > 0) {
            _unstake(withdrawAssetAmountAfterFee);
        }

        emit Unstake(msg.sender, withdrawAssetAmount, amount);
    }

    /**
     * @notice Compound staking rewards for vault
     * @dev Claims staking rewards from PurseStaking Treasury and restakes them to PurseStaking through `_stake`.
     */
    function compound() public nonReentrant whenNotPaused {
        uint256 rewardsToCompound;
        if (IPurseStakingV3(purseStaking).previewClaimableRewards(address(this)) == 0) {
            return;
        } else {
            rewardsToCompound = ITreasury(purseStakingTreasury).claimRewards(address(this));
        }
        if (rewardsToCompound == 0) {
            return;
        }

        //pendingPurseRewards = 0;

        uint256 feeProtocol = rewardsToCompound * feeOnReward / BIPS_DIVISOR;
        uint256 feeCompounder = rewardsToCompound * feeOnCompounder / BIPS_DIVISOR;
        uint256 compoundAmount = rewardsToCompound - feeProtocol - feeCompounder;

        _stake(compoundAmount); //stake to PurseStaking

        IERC20Upgradeable(PURSE).safeTransfer(stakePurseVaultTreasury, feeProtocol);
        IERC20Upgradeable(PURSE).safeTransfer(msg.sender, feeCompounder);

        emit Compound(msg.sender, compoundAmount);
    }

    /**
     * @dev Sends Vested PURSE to the StakePurseVaultVesting contract.
     * Only callable by StakePurseVaultVesting contract. 
     */
    function sendVestedPurse(uint256 safeAmount) external onlyVestedPurse {
        uint256 vaultBalance = IERC20Upgradeable(PURSE).balanceOf(address(this));
        if (vaultBalance < safeAmount) {
           revert("StakePurseVault: Insufficient balance in StakePurseVault");
        }
        IERC20Upgradeable(PURSE).safeTransfer(msg.sender, safeAmount);
        emit SendVestedPurse(safeAmount);
    }

    ///@dev WARNING: only updates the vault's cumulative reward per token value.
    function updateRewards() external nonReentrant {
        _updateRewards(address(0));
    }

    /**
     * @dev Vest all of the vault's vesting schedule(s) in PurseStakingVesting
     */
    function vestFromPSV() external onlyVestedPurse returns (uint256) {
        uint256 totalVested = IPurseStakingVesting(purseStakingVesting).vestCompletedSchedules();
        emit VaultVestedAmount(totalVested);
        return totalVested;
    }

    function claimReward(address receiver) external nonReentrant returns (uint256) {
        return _claim(msg.sender, receiver);
    }

    /**************************************** Internal and Private Functions ****************************************/

    /**
     * @param amount The amount of PURSE tokens to stake to PurseStaking
     * @dev Stakes PURSE tokens to PurseStaking
     */
    function _stake(uint256 amount) internal returns (uint256) {
        //Ensure vault contract has enough allowance to allow PurseStaking to transferFrom
        IERC20Upgradeable(PURSE).safeIncreaseAllowance(purseStaking, amount);
        uint256 receiptTokens = IPurseStakingV3(purseStaking).enter(amount);
        return receiptTokens;
    }

    /**
     * @param amount The amount of PURSE tokens to unstake from PurseStaking
     * @dev Unstakes PURSE tokens from PurseStaking. Receives withdrawn PURSE amount from 
     * PurseStaking. Creates a vesting schedule for the user and their withdrawn PURSE amount
     * Funds will be returned to user's address after vesting period, through `sendVestedPurse`, 
     * which is called by the VestedPurse contract.
     */
    function _unstake(uint256 amount) internal {
        //Expected Purse amount to withdraw -> receiptTokens (purseStakingShareAmount)
        uint256 totalXPurse = IPurseStakingV3(purseStaking).totalReceiptSupply();
        uint256 totalPurse = IPurseStakingV3(purseStaking).availablePurseSupply();
        uint256 purseStakingShareAmount = amount * totalXPurse / totalPurse;

        //Withdraw actual Purse amount from PurseStaking with receiptTokens
        uint256 purseAmount = IPurseStakingV3(purseStaking).leave(purseStakingShareAmount);

        IStakePurseVaultVesting(stakePurseVaultVesting).lockWithEndTime(
            msg.sender,
            purseAmount,
            block.timestamp + vestDuration //endTime
        );
    }

    /**
     * @dev Claims vault rewards for the user who is staking in the vault.
     * Called when `stakePurse` or `unstakePurse` is called. Note that this is
     * not claiming the rewards from PurseStaking Treasury, so reward token is
     * dependent on the multi vault reward distributor token.
     */
    function _claim(address _account, address _receiver) private returns (uint256) {
        _updateRewards(_account);
        UserInfo storage user = userInfo[_account];
        uint256 claimableTokenAmount = user.claimableReward;
        user.claimableReward = 0;

        if (claimableTokenAmount > 0) {
            IERC20Upgradeable(rewardToken()).safeTransfer(_receiver, claimableTokenAmount);
            emit Claim(_account, claimableTokenAmount);
        }

        return claimableTokenAmount;
     }

    /**
     * @dev Calls the multi vault reward distributor contract to distribute block rewards to
     * this vault. Then calculates this vault's cumulative reward per token, and calculates the
     * given account's claimable rewards for staking in this vault, based on the account's shares
     * and prev cumulated reward per token. If called through `updateRewards`, only updates
     * the vault's cumulative reward per token.
     */
    function _updateRewards(address _account) private { 
        uint256 blockRewards = IVaultRewardDistributor(vaultRewardDistributor).distribute(address(this));
        uint256 vaultSharesTotalSupply = totalSupply();
        uint256 _cumulativeRewardPerToken = vaultInfo.cumulativeRewardPerToken;

        if (vaultSharesTotalSupply > 0 && blockRewards > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken + (
                blockRewards * PRECISION / vaultSharesTotalSupply
            );
            vaultInfo.cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }
        // cumulativeRewardPerToken can only increase, so if zero means no rewards distributed yet
        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            UserInfo storage user = userInfo[_account];
            uint256 stakedAmount = balanceOf(_account);
            uint256 accountReward = stakedAmount * (
                _cumulativeRewardPerToken - user.previousCumulatedRewardPerToken
            ) / PRECISION;
            uint256 _claimableReward = user.claimableReward + accountReward;
            user.claimableReward = _claimableReward;
            user.previousCumulatedRewardPerToken = _cumulativeRewardPerToken;
        }
    }

    /**
     * @dev Override `_beforeTokenTransfer` for shares token: StPURSE (ERC20).
     * This function is called when shares are minted, burned, or transferred.
     * Calls `_updateRewards` on the `from` and `to` addresses to update their claimable rewards.
     */
    function _beforeTokenTransfer(
        address from, 
        address to, 
        uint256 amount
    ) internal override whenNotPaused {
        _updateRewards(from);
        _updateRewards(to);

        super._beforeTokenTransfer(from, to, amount);    
    }

    /****************************************** View Functions ******************************************/

    /**
     * @dev IMPORTANT: Override ERC4626's implementation of `totalAssets`.
     * Users' stake in this vault is staked to PurseStaking, so `_asset.balanceOf` with this vault
     * will not be accurate in terms of the asset tokens it holds. The `totalAssets` should
     * be the total amount of PURSE tokens that this vault has staked to PurseStaking.
     * 
     * From the number of receipts tokens this vault has, we can calculate the actual amount of PURSE
     * the vault has staked to PurseStaking by: `receiptTokens * availablePurseSupply / totalReceiptSupply`.
     */
    function totalAssets() public view override returns (uint256) {
        uint256 totalXPurse = IPurseStakingV3(purseStaking).totalReceiptSupply();
        uint256 totalPurse = IPurseStakingV3(purseStaking).availablePurseSupply();

        return IPurseStakingV3(purseStaking).userReceiptToken(address(this))* totalPurse / totalXPurse;
    }

    ///@dev Returns the address of the reward token for staking in this vault.
    function rewardToken() public view returns (address) {
        return IVaultRewardDistributor(vaultRewardDistributor).rewardToken();
    }

    ///@dev Get config parameters for the vault.
    function getVaultConfigs() public view returns (uint256, uint256) {
        return (MIN_COMPOUND_AMOUNT, CAP_STAKE_PURSE_TARGET);
    }

    ///@dev View claimable vault staking reward amount for account.
    function claimable(address account) public view returns (uint256) {
        UserInfo memory user = userInfo[account];
        uint256 stakedAmount = balanceOf(account);
        if (stakedAmount == 0) {
            return user.claimableReward;
        }
        
        uint256 vaultSharesTotalSupply = totalSupply();
        uint256 pendingRewards = IVaultRewardDistributor(
            vaultRewardDistributor
        ).pendingRewards(address(this)) * PRECISION;
        uint256 nextCumulativeRewardPerToken = vaultInfo.cumulativeRewardPerToken + (
            pendingRewards / vaultSharesTotalSupply
        );
        uint256 accountReward = user.claimableReward + (
            stakedAmount * (nextCumulativeRewardPerToken - user.previousCumulatedRewardPerToken) / PRECISION
        );
        return accountReward;
    }

    /************************************* Only Governor Functions *************************************/
    
    function updateVaultConfigs(uint256 newMinCompound, uint256 newCapStakePurse) external onlyRole(GOVERNOR_ROLE) {
        MIN_COMPOUND_AMOUNT = newMinCompound;
        CAP_STAKE_PURSE_TARGET = newCapStakePurse;
        emit ConfigsUpdated(newMinCompound, newCapStakePurse);
    }

    function updateVaultFees(uint256 newFeeOnReward, uint256 newFeeOnCompounder, uint256 newFeeOnWithdrawal) external onlyRole(GOVERNOR_ROLE) {
        feeOnReward = newFeeOnReward;
        feeOnCompounder = newFeeOnCompounder;
        feeOnWithdrawal = newFeeOnWithdrawal;
        emit FeesUpdated(newFeeOnReward, newFeeOnCompounder, newFeeOnWithdrawal);
    }

    /*************************************** Only Owner Functions **************************************/

    function updateStakePurseVaultVesting(address newAddress) external onlyRole(OWNER_ROLE) {
        stakePurseVaultVesting = newAddress;
        emit StakePurseVaultVestingChanged(newAddress);
    }

    function updateStakePurseVaultTreasury(address newAddress) external onlyRole(OWNER_ROLE) {
        stakePurseVaultTreasury = newAddress;
        emit StakePurseVaultTreasuryChanged(newAddress);
    }

    function updateVaultRewardDistributor(address newAddress) external onlyRole(OWNER_ROLE) {
        vaultRewardDistributor = newAddress;
        emit VaultRewardDistributorChanged(newAddress);
    }

    function updatePurseStaking(address newAddress) external onlyRole(OWNER_ROLE) {
        purseStaking = newAddress;
        emit PurseStakingChanged(newAddress);
    }

    function updatePurseStakingTreasury(address newAddress) external onlyRole(OWNER_ROLE) {
        purseStakingTreasury = newAddress;
        emit PurseStakingTreasuryChanged(newAddress);
    }

    function updatePurseStakingVesting(address newAddress) external onlyRole(OWNER_ROLE) {
        purseStakingVesting = newAddress;
        emit PurseStakingVestingChanged(newAddress);
    }

    function updateVestDuration(uint256 _vestDuration) external onlyRole(OWNER_ROLE) {
        vestDuration = _vestDuration;
        emit VestDurationUpdated(_vestDuration);
    }

    function recoverToken(address token, uint256 amount, address _recipient) external onlyRole(OWNER_ROLE) {
        require(_recipient != address(0), "StakePurseVault: Recipient zero address");
        require(token != address(0), "StakePurseVault: Token zero address");
        IERC20Upgradeable(token).safeTransfer(_recipient, amount);
    }
}