const web3 = require("web3");
var obj = require('../artifacts/contracts/utils/orionpool/core/OrionPoolV2Pair.sol/OrionPoolV2Pair.json');
var bin = Buffer.from(obj.bytecode.substr(2), 'hex');
var hash = web3.utils.keccak256(bin);
console.log(hash);
