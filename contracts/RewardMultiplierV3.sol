// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IMasterChefV2} from "./interfaces/IMasterChefV2.sol";

import "./Governable.sol";

contract RewarderViaMultiplierV3 is Initializable, UUPSUpgradeable, PausableUpgradeable, Governable {
    
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address[] public rewardTokens;
    uint256[] public rewardMultipliers;
    uint256[] public cumulativeRewardPerToken;

    address public CHEF_V2;
    uint256 public BASE_REWARD_TOKEN_DIVISOR;
    uint256 public tokenTrackerId;
    uint256 public lastDistributionTime;
    
    mapping(address => mapping(uint256 => UserInfo)) internal userRewardInfo;
    address public treasury;

    struct UserInfo {
        uint256 claimableReward;
        uint256 previousCumulatedRewardPerToken;
    }

    event RewardTokenAdded(address indexed _token, uint256 indexed _multiplier);
    event RewardTokenRemoved(uint256 indexed _pid, address indexed _token);
    event MultiplierUpdated(uint256 indexed _pid, uint256 indexed _multiplier);
    event ReturnToken(address indexed _token, address indexed _to, uint256 _amount);
    event Claim(address indexed _account, address indexed _token, uint256 _amount);


    /**************************************** Only Operator/Governor Functions ****************************************/

    function onReward(address _user, uint256 /*_rewardAmount*/) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        _claim(_user);
    }

    function updateLastDistributionTime() external onlyRole(GOVERNOR_ROLE) {
        lastDistributionTime = block.timestamp;
    }

    /**************************************** Internal Functions ****************************************/

    function _claim(address account) private returns (uint256[] memory amounts) {
        _updateRewards(account);
        amounts = new uint256[](rewardTokens.length);
        for (uint256 i; i < rewardTokens.length;) {
            UserInfo storage user = userRewardInfo[account][i];
            uint256 tokenAmount = user.claimableReward;
            address rewardToken = rewardTokens[i];
            user.claimableReward = 0;

            if (tokenAmount > 0) {
                IERC20Upgradeable(rewardToken).safeTransfer(account, tokenAmount);
                emit Claim(account, rewardToken ,tokenAmount);
            }

            amounts[i] = tokenAmount;

            unchecked { ++i; }
        }
        return amounts;
    }

    function _updateRewards(address account) private {
        uint256[] memory blockReward = _distribute();
        (uint256 userDeposit, ) = IMasterChefV2(CHEF_V2).userInfo(tokenTrackerId, account);
        (address lpToken, , , ) = IMasterChefV2(CHEF_V2).poolInfo(tokenTrackerId);
        uint256 totalDeposit = IERC20Upgradeable(lpToken).balanceOf(CHEF_V2);

        for (uint256 i; i < rewardTokens.length;) {
            uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken[i];
            if (totalDeposit > 0 && blockReward[i] > 0) {
                _cumulativeRewardPerToken = _cumulativeRewardPerToken + (blockReward[i] * (BASE_REWARD_TOKEN_DIVISOR) / (totalDeposit));
                cumulativeRewardPerToken[i] = _cumulativeRewardPerToken;
            }

            // cumulativeRewardPerToken can only increase
            // so if cumulativeRewardPerToken is zero, it means there are no rewards yet
            if (_cumulativeRewardPerToken == 0) {
                return;
            }

            if (account != address(0)) {
                UserInfo storage user = userRewardInfo[account][i];
                uint256 accountReward = userDeposit * (_cumulativeRewardPerToken - (user.previousCumulatedRewardPerToken)) / (BASE_REWARD_TOKEN_DIVISOR);
                uint256 _claimableReward = user.claimableReward + (accountReward);

                user.claimableReward = _claimableReward;
                user.previousCumulatedRewardPerToken = _cumulativeRewardPerToken;
            }

            unchecked { ++i; }
        }
    }

    function _distribute() private returns (uint256[] memory amounts) {
        amounts = pendingRewards();

        lastDistributionTime = block.timestamp;
        
        for (uint256 i; i < rewardTokens.length;) {
            if (amounts[i] == 0) { continue; }

            uint256 balance = IERC20Upgradeable(rewardTokens[i]).balanceOf(treasury);
            if (amounts[i] > balance) { amounts[i] = balance; }
            IERC20Upgradeable(rewardTokens[i]).safeTransferFrom(treasury, address(this), amounts[i]);

            unchecked { ++i; }
        }
        
        return amounts;
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(OWNER_ROLE) {} 

    /**************************************** View Functions ****************************************/

    /**
     * @notice Pending reward for whole pool.
     */
    function pendingRewards() public view returns (uint256[] memory amounts) {
        amounts = new uint256[](rewardTokens.length);
        for (uint256 i; i < rewardTokens.length;) {
            if (block.timestamp == lastDistributionTime) {
                amounts[i] = 0;
            }

            uint256 timeDiff = block.timestamp.sub(lastDistributionTime);
            amounts[i] = rewardMultipliers[i].mul(timeDiff);

            unchecked { ++i; }
        }

        return amounts;
    }

    /**
     * @notice Return pending reward for user.
     */
    function claimable(address account) public view returns (uint256[] memory amounts) {
        (uint256 userDeposit, ) = IMasterChefV2(CHEF_V2).userInfo(tokenTrackerId, account);
        uint256[] memory pendingReward = pendingRewards();
        amounts = new uint256[](rewardTokens.length);

        for (uint256 i; i < rewardTokens.length;) {
            UserInfo memory user = userRewardInfo[account][i];
            
            if (userDeposit == 0) {
                amounts[i] = user.claimableReward;
            }

            (address lpToken, , , ) = IMasterChefV2(CHEF_V2).poolInfo(tokenTrackerId);
            uint256 totalDeposit = IERC20Upgradeable(lpToken).balanceOf(CHEF_V2);
            uint256 nextCumulativeRewardPerToken = cumulativeRewardPerToken[i] + (pendingReward[i] * BASE_REWARD_TOKEN_DIVISOR / totalDeposit);
            amounts[i] = user.claimableReward + (
                userDeposit * (nextCumulativeRewardPerToken - (user.previousCumulatedRewardPerToken)) / (BASE_REWARD_TOKEN_DIVISOR));

            unchecked { ++i; }
        }

        return amounts;
    }

    function getRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    function getRewardMultipliers() external view returns (uint256[] memory) {
        return rewardMultipliers;
    }

    function getUserRewardInfo(address _user, uint256 _i) external view returns (uint256, uint256) {
        UserInfo memory user = userRewardInfo[_user][_i];
        return (user.claimableReward, user.previousCumulatedRewardPerToken);
    }

    /**************************************** ONLY OWNER FUNCTIONS ****************************************/

    function pause() external whenNotPaused onlyRole(OWNER_ROLE) {
        _pause();
    }

    function unpause() external whenPaused onlyRole(OWNER_ROLE) {
        _unpause();
    }

    function addRewardToken(address _rewardToken, uint96 _multiplier) external onlyRole(OWNER_ROLE) {
        rewardTokens.push(_rewardToken);
        rewardMultipliers.push(_multiplier);
        cumulativeRewardPerToken.push(0);
        require(address(_rewardToken) != address(0), "Cannot be zero address");
        require(_multiplier > 0, "Invalid multiplier");

        emit RewardTokenAdded(address(_rewardToken), _multiplier);
    }

    function updateMultiplier(uint256 _pid, uint96 _multiplier) external onlyRole(OWNER_ROLE) {
        require(lastDistributionTime != 0, "RewardDistributor: invalid lastDistributionTime");
        _updateRewards(address(0));
        rewardMultipliers[_pid] = _multiplier;

        emit MultiplierUpdated(_pid, _multiplier);
    }

    function updateTreasury(address _treasury) external onlyRole(OWNER_ROLE) {
        treasury = _treasury;
    }

    /**
     * @notice DO NOT USE UNLESS YOU ARE SURE WHAT YOU ARE DOING, SET REWARDMULTIPLIER TO 0 IF YOU DONT WANT THAT REWARD TOKEN
     */
    function removeRewardToken(uint256 _pid) external onlyRole(OWNER_ROLE) {
        uint256 rewardInfoLength = rewardTokens.length;
        require(_pid < rewardInfoLength, "RewarderDistributor: invalid pid argument");
        address rewardTokenRemove = address(rewardTokens[_pid]);
        uint256 lastIndex = rewardInfoLength - 1;
        if (_pid != lastIndex) {
            rewardTokens[_pid] = rewardTokens[lastIndex];
            rewardMultipliers[_pid] = rewardMultipliers[lastIndex];
        }
        //pop last element since we already moved it to replace the struct at _pid index
        rewardTokens.pop();
        rewardMultipliers.pop();
        emit RewardTokenRemoved(_pid, rewardTokenRemove);
    }

    function returnToken(address _token, address _to, uint256 _amount) external onlyRole(OWNER_ROLE) {
        require(_to != address(0), "RewarderDistributor: zero address");
        require(_amount > 0, "RewarderDistributor: zero amount");
        IERC20Upgradeable(_token).safeTransfer(_to, _amount);

        emit ReturnToken(_token, _to, _amount);
    }

    /**************************************************************
     * @dev Initialize the states
     *************************************************************/
    function initialize(
        address[] memory _rewardTokens,
        uint256[] memory _rewardMultipliers,
        uint256 _baseRewardTokenDecimal,
        address _chefV2,
        uint256 _tokenTrackerId,
        address _owner, 
        address _governor
    ) public initializer {
        rewardTokens = _rewardTokens;
        rewardMultipliers = _rewardMultipliers;
        cumulativeRewardPerToken = new uint256[](rewardTokens.length);
        BASE_REWARD_TOKEN_DIVISOR = 10 ** _baseRewardTokenDecimal;
        CHEF_V2 = _chefV2;
        tokenTrackerId =  _tokenTrackerId;

        __Governable_init(_owner, _governor);
        __UUPSUpgradeable_init();
    }
}