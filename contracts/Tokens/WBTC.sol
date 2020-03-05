pragma solidity 0.5.10;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';

contract WBTC is ERC20Detailed, ERC20Capped{
    constructor()
        ERC20Detailed("Wrapped Bitcoin", "WBTC", 8)
        ERC20Capped(100e6 * 10 ** 8) public {
    }
}