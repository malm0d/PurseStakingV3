// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract RetroactiveRewards is Ownable{
    using SafeERC20 for IERC20;

    address public constant PURSE = 0x29a63F4B209C29B4DC47f06FFA896F32667DAD2C;
    bytes32 public merkleRoot;
    uint128 public rewardStartTime;
    uint128 public rewardEndTime;

    mapping(address => bool) public isClaim;

    constructor(bytes32 _merkleRoot) {
        merkleRoot = _merkleRoot;
    }

    event Claim(address user, uint256 amount);
    event UpdatedClaimPeriod(uint128 startTime, uint128 endTime);
    event UpdatedMerkleRoot(bytes32 merkleRoot);

    function updateMerkleRoot(bytes32 _newMerkleRoot) external onlyOwner {
        require(_newMerkleRoot != merkleRoot, "newMerkleRoot must not be equal to merkleRoot");
        merkleRoot = _newMerkleRoot;
        emit UpdatedMerkleRoot(merkleRoot);
    }

    function updateRewardsPeriod(uint128 startTime, uint128 endTime) external onlyOwner {
        require(endTime > startTime, "endTime must be greater than startTime");
        require(endTime > block.timestamp, "Invalid timestamp");
        rewardStartTime = startTime;
        rewardEndTime = endTime;
        emit UpdatedClaimPeriod(rewardStartTime, rewardEndTime);
    }

    function claimRewards(uint256 amount, bytes32[] calldata merkleProof) external {
        require(block.timestamp >= rewardStartTime, "Claim not started");
        require(block.timestamp <= rewardEndTime, "Claim ended");
        require(!isClaim[msg.sender], "Already claimed");

        bytes32 node = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verifyCalldata(merkleProof, merkleRoot, node), 'Invalid proof.');
        isClaim[msg.sender] = true;

        emit Claim(msg.sender, amount);
        IERC20(PURSE).safeTransfer(msg.sender, amount);
    }

    function returnToken(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Zero address");
        IERC20(token).safeTransfer(to, amount);
    }
}
