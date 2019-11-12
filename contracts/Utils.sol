pragma solidity 0.5.10;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/SafeCast.sol';

contract Utils {

    using SafeMath for uint;

    uint256 private _guardCounter;

    constructor () internal {
        // The counter starts at one to prevent changing it from zero to a non-zero
        // value, which is a more expensive operation.
        _guardCounter = 1;
    }

    /**
     * @dev OpenZeppelin ReentrancyGuard
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 localCounter = _guardCounter;
        _;
        require(localCounter == _guardCounter, "ReentrancyGuard: reentrant call");
    }

    /**
        @notice convert asset amount from8 decimals (10^8) to its base unit
     */
    function decimalToBaseUnit(address assetAddress, uint64 _amount) public view returns(uint){
        uint amount = uint(_amount); // conver to uint256

        if(assetAddress == address(0)){
            return amount.mul(1 ether).div(10**8); // 18 decimals
        }

        ERC20Detailed asset = ERC20Detailed(assetAddress);
        uint decimals = asset.decimals();

        return amount.mul(10**decimals).div(10**8);
    }

    /**
        @notice convert asset amount from its base unit to 8 decimals (10^8)
     */
    function baseUnitToDecimal(address assetAddress, uint amount) public view returns(uint64){

        if(assetAddress == address(0)){
            return uint64(amount.mul(10**8).div(1 ether));
        }

        ERC20Detailed asset = ERC20Detailed(assetAddress);
        uint decimals = asset.decimals();

        return uint64(amount.mul(10**8).div(10**decimals));
    }

    /**
        @notice Retrieve sender of transaction
        @dev Provides information about the current execution context, including the
        sender of the transaction and its data. While these are generally available
        via msg.sender and msg.data, they should not be accessed in such a direct
        manner, since when dealing with GSN meta-transactions the account sending and
        paying for execution may not be the actual sender (as far as an application
        is concerned).
     */
    function _msgSender() internal view returns (address payable) {
        return msg.sender;
    }

    function safeTransfer(address to, address assetAddress, uint amount) internal nonReentrant{
        if(assetAddress == address(0)){
            uint balanceBeforeTransfer = address(this).balance;
            // solhint-disable-next-line
            (bool success, ) = to.call.value(amount)("");
            require(success, "transfer was not successful");
            assert(address(this).balance == balanceBeforeTransfer.sub(amount));
        }
        else{
            IERC20 asset = IERC20(assetAddress);
            uint balanceBeforeTransfer = asset.balanceOf(address(this));            
            require(asset.transfer(_msgSender(), amount), "error transfering funds to user");
            assert( asset.balanceOf(address(this)) == balanceBeforeTransfer.sub(amount));
        }
        
    }
    

}