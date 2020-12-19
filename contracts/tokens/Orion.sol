pragma solidity ^0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';
import './Mintable.sol';

contract Orion is Mintable {
    constructor()
        ERC20("Orion", "ORN")
        ERC20Capped(100e6 * 1 ether) public {
        _setupDecimals(8);
    }
}
