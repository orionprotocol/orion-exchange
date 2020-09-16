pragma solidity 0.5.10;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';

contract Orion is ERC20Detailed, ERC20Capped{
    constructor()
        ERC20Detailed("Orion", "ORN", 8)
        ERC20Capped(100e6 * 1 ether) public {
    }
}
