pragma experimental ABIEncoderV2;
pragma solidity ^0.5.10;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract Utils {

    using SafeMath for uint;

    /*
    keccak256(abi.encodePacked(
        'address senderAddress',
        'address matcherAddress',
        'address baseAsset',
        'address quoteAsset',
        'address matcherFeeAsset',
        'uint64 amount',
        'uint64 price',
        'uint64 matcherFee',
        'uint64 nonce',
        'uint64 expiration',
        'string side'
    ));
    */
    bytes32 public constant TYPE_HASH = 0xcaaa6b2be79f0f491c84424955bf722021c1f7bc69ed88615b61fd53fadae921;


    struct Order{
        address senderAddress;
        address matcherAddress;
        address baseAsset;
        address quoteAsset;
        address matcherFeeAsset;
        uint64 amount;
        uint64 price;
        uint64 matcherFee;
        uint64 nonce;
        uint64 expiration;
        string side; // buy or sell
        bytes signature;
    }

     function validateAddress(Order memory order) public pure returns (bool) {
        bytes32 typeHash = TYPE_HASH;
        bytes32 valueHash = getValueHash(order);
        
        return recover(keccak256(abi.encodePacked(typeHash, valueHash)), order.signature) == order.senderAddress;
    }

    function getValueHash(Order memory _order) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _order.senderAddress,
            _order.matcherAddress,
            _order.baseAsset,
            _order.quoteAsset,
            _order.matcherFeeAsset,
            _order.amount,
            _order.price,
            _order.matcherFee,
            _order.nonce,
            _order.expiration,
            _order.side
        ));
    }

    function recover(bytes32 hash, bytes memory signature) public pure returns (address)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;

        (v, r, s) = splitSignature(signature);

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return (address(0));
        } else {
            // solium-disable-next-line arg-overflow
            return ecrecover(hash, v, r, s);
        }
    }

    function splitSignature(bytes memory sig) public pure returns (uint8, bytes32, bytes32)
    {
        require(sig.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }

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