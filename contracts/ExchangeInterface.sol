pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
import "./libs/MarginalFunctionality.sol";

contract ExchangeInterface {
    function moveToStake(address user, uint64 amount) public {
    }
    function moveFromStake(address user, uint64 amount) public {
    }
    function liabilities(address user, uint256 index) public returns (MarginalFunctionality.Liability memory) {
    }
}
