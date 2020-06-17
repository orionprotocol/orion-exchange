pragma experimental ABIEncoderV2;
pragma solidity 0.5.10;

contract Validator {
    string public constant DOMAIN_NAME = "Orion Exchange";
    string public constant DOMAIN_VERSION = "1";
    uint256 public constant CHAIN_ID = 4;
    bytes32
        public constant DOMAIN_SALT = 0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        abi.encodePacked(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
        )
    );
    bytes32 private constant ORDER_TYPEHASH = keccak256(
        abi.encodePacked(
            "Order(address senderAddress,address matcherAddress,address baseAsset,address quoteAsset,address matcherFeeAsset,uint64 amount,uint64 price,uint64 matcherFee,uint64 nonce,uint64 expiration,string side)"
        )
    );

    bytes32 public DOMAIN_SEPARATOR;

    constructor() public {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                CHAIN_ID,
                address(this),
                DOMAIN_SALT
            )
        );
    }

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
    }

    function signerOfOrder(Order memory order, bytes memory signature)
        public
        view
        returns (address)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hash(order))
        );

        if (signature.length != 65) {
            revert("ECDSA: invalid signature length");
        }

        // Divide the signature in r, s and v variables
        bytes32 r;
        bytes32 s;
        uint8 v;

        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            revert("ECDSA: invalid signature 's' value");
        }

        if (v != 27 && v != 28) {
            revert("ECDSA: invalid signature 'v' value");
        }

        return ecrecover(digest, v, r, s);
    }

    function hash(Order memory _order) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
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
