pragma solidity ^0.6.2;
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract Mintable is ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        _mint(to, amount);  
    }

    constructor() internal {
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function isMinter(address user) public view returns (bool) {
      return hasRole(MINTER_ROLE, user);
    }

    function addMinter(address newMinter) public {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        _setupRole(MINTER_ROLE, newMinter);
    }        
}
