pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import './Mintable.sol';

contract LINK is Mintable {
    constructor()
        ERC20("LINK (5b$ token and counting)", "LINK")
        ERC20Capped(100e6 * 10**8) public {
        _setupDecimals(8);
    }
}
