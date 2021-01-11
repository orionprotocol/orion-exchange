pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import './Mintable.sol';

contract GenericToken is Mintable{
    constructor(string memory longName, string memory ticker, uint cappedAmount, uint8 decimal)
        ERC20(longName, ticker)
        ERC20Capped(cappedAmount)
        public {
        _setupDecimals(decimal);
    }
}

