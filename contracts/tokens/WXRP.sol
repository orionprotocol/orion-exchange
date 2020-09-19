pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WXRP is ERC20{
    constructor() public ERC20("Wrapped Ripple", "WXRP") {
        _mint(msg.sender, 100e6 * 10**8);
        _setupDecimals(8);
    }
}
