// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract RewarderViaMultiplierV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {

    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable[] public rewardTokens;
    uint256[] public rewardMultipliers;
    address private CHEF_V2;
    uint256 private BASE_REWARD_TOKEN_DIVISOR;
    mapping(address => mapping(uint256 => uint256)) private rewardDebts;

    function addRewardToken(IERC20Upgradeable _rewardToken, uint256 _multiplier) onlyOwner external {
        rewardTokens.push(_rewardToken);
        rewardMultipliers.push(_multiplier);
        require(address(_rewardToken) != address(0), "Cannot be zero address");
        require(_multiplier > 0, "Invalid multiplier");
    }

    function updateMultiplier(uint256 pid, uint256 _multiplier) onlyOwner external {
        rewardMultipliers[pid] = _multiplier;
    }
    
    function onReward(address user, uint256 rewardAmount) onlyMCV2 external {
        for (uint256 i; i < rewardTokens.length; ++i) {
            uint256 pendingReward = rewardDebts[user][i].add(rewardAmount.mul(rewardMultipliers[i]).div(BASE_REWARD_TOKEN_DIVISOR));
            uint256 rewardBal = rewardTokens[i].balanceOf(address(this));
            if (pendingReward > rewardBal) {
                rewardDebts[user][i] = pendingReward - rewardBal;
                rewardTokens[i].safeTransfer(user, rewardBal);
            } else {
                rewardDebts[user][i] = 0;
                rewardTokens[i].safeTransfer(user, pendingReward);
            }
        }
    }
        
    function pendingTokens(address user, uint256 rewardAmount) external view returns (IERC20Upgradeable[] memory tokens, uint256[] memory amounts) {
        amounts = new uint256[](rewardTokens.length);
        for (uint256 i; i < rewardTokens.length; ++i) {
            uint256 pendingReward = rewardDebts[user][i].add(rewardAmount.mul(rewardMultipliers[i]).div(BASE_REWARD_TOKEN_DIVISOR));
            uint256 rewardBal = rewardTokens[i].balanceOf(address(this));
            if (pendingReward > rewardBal) {
                amounts[i] = rewardBal;
            } else {
                amounts[i] = pendingReward;
            }
        }
        return (rewardTokens, amounts);
    }

    function getRewardTokens() external view returns (IERC20Upgradeable[] memory) {
        return rewardTokens;
    }

    function getRewardMultipliers() external view returns (uint256[] memory) {
        return rewardMultipliers;
    }

    // DO NOT USE
    function deleteRewardToken() external onlyOwner{
        rewardTokens.pop();
        rewardMultipliers.pop();
    }

    function recoverToken(address token, uint256 amount, address _to) public onlyOwner {
        require(_to != address(0), "send to the zero address");
        IERC20Upgradeable(token).safeTransfer(_to, amount);
    }

    modifier onlyMCV2 {
        require(
            msg.sender == CHEF_V2,
            "Only MCV2 can call this function."
        );
        _;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function initialize(
        IERC20Upgradeable[] memory _rewardTokens,
        uint256[] memory _rewardMultipliers,
        uint256 _baseRewardTokenDecimal,
        address _chefV2
    ) public initializer {
        rewardTokens = _rewardTokens;
        rewardMultipliers = _rewardMultipliers;
        BASE_REWARD_TOKEN_DIVISOR = 10 ** _baseRewardTokenDecimal;
        CHEF_V2 = _chefV2;

        __Ownable_init();
        __UUPSUpgradeable_init();
    }
}