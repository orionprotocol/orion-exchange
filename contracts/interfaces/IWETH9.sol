// SPDX-License-Identifier: GNU
pragma solidity >0.7.0;

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
}
