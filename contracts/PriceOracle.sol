pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./libs/EIP712Interface.sol";
/**
 * @title PriceOracle
 * @dev Contract for storing and providing price data for the Orion Protocol
 * @author @EmelyanenkoK
 */
contract PriceOracle is EIP712Interface {

    struct Prices {
        address[] assetAddresses;
        uint64[] prices;
        uint64 timestamp;
        bytes signature;
    }

    struct PriceDataOut {
        uint64 price;
        uint64 timestamp;
    }

    bytes32 public constant PRICES_TYPEHASH = keccak256(
        abi.encodePacked(
            "Prices(address[] assetAddresses,uint64[] prices,uint64 timestamp)"
        )
    );

    address public oraclePublicKey;
    mapping(address => PriceDataOut) public assetPrices;

    constructor(address publicKey) public {
        oraclePublicKey = publicKey;
    }

    function checkPriceFeedSignature(Prices memory priceFeed) public view returns (bool) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                getPricesHash(priceFeed)
            )
        );

        if (priceFeed.signature.length != 65) {
            revert("ECDSA: invalid signature length");
        }

        // Divide the signature in r, s and v variables
        bytes32 r;
        bytes32 s;
        uint8 v;

        bytes memory signature = priceFeed.signature;

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

        return ecrecover(digest, v, r, s) == oraclePublicKey;
    
    }

    function provideData(Prices memory priceFeed) public {
       require(checkPriceFeedSignature(priceFeed), "Wrong signature");
       for(uint8 i=0; i<priceFeed.assetAddresses.length; i++) {
         PriceDataOut storage assetData = assetPrices[priceFeed.assetAddresses[i]];
         if(assetData.timestamp<priceFeed.timestamp) {
           assetData.price = priceFeed.prices[i];
           assetData.timestamp = priceFeed.timestamp;
         }
       }
    }

    function givePrices(address[] calldata assetAddresses) external view returns (PriceDataOut[] memory) {
      PriceDataOut[] memory result = new PriceDataOut[](assetAddresses.length);
      for(uint8 i=0; i<assetAddresses.length; i++) {
        result[i] = assetPrices[assetAddresses[i]];
      }
      return result;
    }
    
    function getPricesHash(Prices memory priceVector)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    PRICES_TYPEHASH,
                    keccak256(abi.encodePacked(priceVector.assetAddresses)),
                    keccak256(abi.encodePacked(priceVector.prices)),
                    priceVector.timestamp
                )
            );
    }
}
