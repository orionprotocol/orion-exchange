pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

/**
 * @title PriceOracle
 * @dev Contract for storing and providing price data for the Orion Protocol
 * @author @EmelyanenkoK
 */
contract PriceOracle {

    struct PriceDataIn {
        address assetAddress;
        uint64 price;
        uint64 volatility;
    }
    struct PriceVector {
        PriceDataIn[] data;
        uint64 timestamp;
    }

    struct PriceDataOut {
        address assetAddress;
        uint64 price;
        uint64 timestamp;
    }

    address oraclePublicKey;

    constructor(address publicKey) internal {
        oraclePublicKey = publicKey;
    }

    function provideData(PriceVector calldata priceFeed) external {
    }

    function givePrices(address user) external view returns (PriceDataOut[] memory) {
    }
}
