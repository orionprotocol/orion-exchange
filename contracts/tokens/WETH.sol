pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';
import './Mintable.sol';

contract WETH is Mintable{
    constructor()
        ERC20("Wrapped Ether", "WETH")
        ERC20Capped(100e6 * 1 ether) public {
    }
}
