pragma solidity ^0.5.10;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract Utils {

    using SafeMath for uint;

    function decimalToBaseUnit(address assetAddress, uint64 _amount) public view returns(uint){
        uint amount = uint(_amount); // conver to uint256

        if(assetAddress == address(0)){
            return amount.mul(1 ether).div(10**8); // 18 decimals
        }

        ERC20Detailed asset = ERC20Detailed(assetAddress);
        uint decimals = asset.decimals();

        return amount.mul(10**decimals).div(10**8);
    }

    function baseUnitToDecimal(address assetAddress, uint amount) public view returns(uint64){

        if(assetAddress == address(0)){
            return uint64(amount.mul(10**8).div(1 ether));
        }

        ERC20Detailed asset = ERC20Detailed(assetAddress);
        uint decimals = asset.decimals();

        return uint64(amount.mul(10**8).div(10**decimals));
    }

}