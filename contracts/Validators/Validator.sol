pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/cryptography/ECDSA.sol';

contract Validator {

    using ECDSA for bytes32;

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

    /**
        @notice main entry point to Signature Validation
     */
    function isValidSignature(Order memory order) public pure returns(bool) {
        bytes32 orderHash = getOrderhash(order);
        address recovered = orderHash.recover(order.signature);
        return recovered == order.senderAddress;
    }

    /**
        @notice Get the hash of an order
        @dev Order is created with bytes representation and hashed using web3.utils.soliditySha3 (old version)
        @param _order The order struct to get the hash from
     */
    function getOrderhash(Order memory _order) public pure returns(bytes32){
        bytes32 buySide = keccak256(abi.encodePacked("buy"));

        return keccak256(abi.encodePacked(
            bytes1(0x03),
            _order.senderAddress,
            _order.matcherAddress,
            _order.baseAsset,
            _order.quoteAsset,
            _order.matcherFeeAsset,
            bytes8(_order.amount),
            bytes8(_order.price),
            bytes8(_order.matcherFee),
            bytes8(_order.nonce),
            bytes8(_order.expiration),
            keccak256(abi.encodePacked(_order.side)) == buySide ? bytes1(0x00):bytes1(0x01)
        ));
    }
}