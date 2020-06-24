pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

library ValidatorV1 {
    using ECDSA for bytes32;

    bytes32 public constant TYPE_HASH = keccak256(
        abi.encodePacked(
            "address senderAddress",
            "address matcherAddress",
            "address baseAsset",
            "address quoteAsset",
            "address matcherFeeAsset",
            "uint64 amount",
            "uint64 price",
            "uint64 matcherFee",
            "uint64 nonce",
            "uint64 expiration",
            "string side"
        )
    );

    // bytes32 public constant TYPE_HASH = 0x780982dd45b7930f3e71393eb3867ca735e735c553a8067145363bb3b7e2c47c;

    struct Order {
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

    function validateV1(Order memory order) public pure returns (bool) {
        bytes32 typeHash = TYPE_HASH;
        bytes32 valueHash = getTypeValueHash(order);
        bytes32 orderHash = keccak256(abi.encodePacked(typeHash, valueHash));

        address recovered = orderHash.recover(order.signature);
        return recovered == order.senderAddress;
    }

    function getTypeValueHash(Order memory _order)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
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
                )
            );
    }
}
