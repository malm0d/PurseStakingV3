const StandardMerkleTree = require("@openzeppelin/merkle-tree").StandardMerkleTree;
const fs = require("fs");

//Sample 10 tokenIds
//uint256 tokenId, string _str
const data = [
    ["", "red"],
    ["", "orange"],
    ["", "purple"],
    ["", "blue"],
    ["", "green"],
    ["", "red"],
    ["", "orange"],
    ["", "purple"],
    ["", "blue"],
    ["", "green"],
]