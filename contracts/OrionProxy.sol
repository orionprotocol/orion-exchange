pragma solidity 0.5.10;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import './Utils.sol';
import './Validators/ValidatorV1.sol';

/**
 * @title Proxy Contract
 * @dev Proxy Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
contract OrionProxy is Ownable{

    bytes32 public constant TYPE_HASH = 0x780982dd45b7930f3e71393eb3867ca735e735c553a8067145363bb3b7e2c47c;

    uint256 private _guardCounter;

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade{
        uint filledPrice;
        uint filledAmount;
        uint feePaid;
        uint timestamp;
    }

    // Get trades by orderHash
    mapping(bytes32 => Trade[]) public trades;

    // Get trades by orderHash
    mapping(bytes32 => Status) public orderStatus;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint)) private assetBalances;

    // Pause or unpause exchangebuyOrderHash
    bool public isActive = true;

    address public implementation;
    

    constructor(address _implementation) public{
        setImplementation(_implementation);
    }

    function setImplementation(address _implementation) public onlyOwner{
        implementation = _implementation;
    }

    function() external payable{
        address _imp = implementation;

        assembly {
            let ptr := mload(0x40)

            // (1) copy incoming call data
            calldatacopy(ptr, 0, calldatasize)

            // (2) forward call to logic contract
            let result := delegatecall(gas, _imp, ptr, calldatasize, 0, 0)
            let size := returndatasize

            // (3) retrieve return data
            returndatacopy(ptr, 0, size)

            // (4) forward return data back to caller
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }

    }

}
