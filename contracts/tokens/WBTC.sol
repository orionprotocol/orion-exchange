pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import './Mintable.sol';

contract WBTC is Mintable {
    constructor()
        ERC20("Wrapped Bitcoin", "WBTC")
        ERC20Capped(100e6 * 10**8) public {
        _setupDecimals(8);
    }
}
