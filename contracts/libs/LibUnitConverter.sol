pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';


library LibUnitConverter {

    using SafeMath for uint;

    /**
        @notice convert asset amount from8 decimals (10^8) to its base unit
     */
    function decimalToBaseUnit(address assetAddress, uint amount) public view returns(uint){
        // uint amount = uint(_amount); // conver to uint256

        if(assetAddress == address(0)){
            return amount.mul(1 ether).div(10**8); // 18 decimals
        }

        ERC20 asset = ERC20(assetAddress);
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

        ERC20 asset = ERC20(assetAddress);
        uint decimals = asset.decimals();

        return uint64(amount.mul(10**8).div(10**decimals));
    }
}
