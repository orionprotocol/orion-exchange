pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import './Mintable.sol';

contract USDT is Mintable{
    constructor()
        ERC20("USDT", "USDT")
        ERC20Capped(100e6 * 1e6) 
        public {
        _setupDecimals(6);
    }
}
