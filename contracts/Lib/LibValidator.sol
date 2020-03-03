pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;


import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';


library LibValidator {
    using ECDSA for bytes32;
    using SafeMath for uint256;
    using SafeMath for uint64;

    /*
        keccak256(abi.encodePacked(
            'uint8 version',
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
    bytes32 public constant TYPE_HASH = 0x780982dd45b7930f3e71393eb3867ca735e735c553a8067145363bb3b7e2c47c;

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

     function validateV1(Order memory order) public pure returns (bool) {
        bytes32 typeHash = TYPE_HASH;
        bytes32 valueHash = getTypeValueHash(order);
        bytes32 orderHash = keccak256(abi.encodePacked(typeHash, valueHash));
        
        address recovered = orderHash.recover(order.signature);
        return recovered == order.senderAddress;
    }

    function getTypeValueHash(Order memory _order) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            uint8(3),
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

    function checkOrdersInfo(
        Order memory buyOrder, Order memory sellOrder, address sender,
        uint filledAmount, uint filledPrice, uint currentTime
    )
        public pure
        returns (bool success)
    {
        require(validateV1(buyOrder), "E2");
        require(validateV1(sellOrder), "E2");

        // Same matcher address
        require(buyOrder.matcherAddress == sender && sellOrder.matcherAddress == sender, "E3");

        // Check matching assets
        require(buyOrder.baseAsset == sellOrder.baseAsset && buyOrder.quoteAsset == sellOrder.quoteAsset, "E3");

        // Check order amounts
        require(filledAmount <= buyOrder.amount, "E3");
        require(filledAmount <= sellOrder.amount, "E3");

        // Check Price values
        require(filledPrice <= buyOrder.price, "E3");
        require(filledPrice >= sellOrder.price, "E3");

        // Check Expiration Time. Convert to seconds first
        require(buyOrder.expiration.div(1000) >= currentTime, "E4");
        require(sellOrder.expiration.div(1000) >= currentTime, "E4");

        success = true;
    }
}