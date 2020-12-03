pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import './Mintable.sol';

contract WXRP is Mintable{
    constructor()
        ERC20("Wrapped XRP", "WXRP")
        ERC20Capped(100e6 * 1e8) 
        public {
        _setupDecimals(8);
    }
}
