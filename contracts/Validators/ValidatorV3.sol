pragma experimental ABIEncoderV2;
pragma solidity 0.5.10;

contract Validator {

    string constant public DOMAIN_NAME = 'Orion Exchange';
    string constant public DOMAIN_VERSION = '1';
    bytes32 constant public DOMAIN_SALT = 0xbf7c844597cc901be5335f7c303eeef89b16c7a598875c2ff4d345bdcd7524b5;

  
    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
    ));
    bytes32 private constant ORDER_TYPEHASH = keccak256(abi.encodePacked(
        "Order(address senderAddress,address matcherAddress,address baseAsset,address quoteAsset,address matcherFeeAsset,uint64 amount,uint64 price,uint64 matcherFee,uint64 nonce,uint64 expiration,string side)"
    ));
 
    bytes32 public DOMAIN_SEPARATOR;

    constructor(uint256 _chainId) public {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(DOMAIN_NAME)),
            keccak256(bytes(DOMAIN_VERSION)),
            _chainId,
            address(this),
            DOMAIN_SALT
        ));
    }

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
    }

    struct Signature{
        bytes32 r;
        bytes32 s;
        uint8 v ;
    }

    function signerOfOrder(Order memory order, Signature memory sig) private view returns (address) {
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            hash(order)
        ));

        return ecrecover(digest, sig.v, sig.r, sig.s);
    }

    function hash(Order memory _order) private pure returns (bytes32) {
        return keccak256(abi.encode(
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
        ));
    }
}