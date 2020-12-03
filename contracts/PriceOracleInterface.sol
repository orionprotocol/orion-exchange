pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;
contract PriceOracleInterface {
    struct PriceDataOut {
        uint64 price;
        uint64 timestamp;
    }
    mapping(address => PriceDataOut) public assetPrices;
    function givePrices(address[] calldata assetAddresses) external view returns (PriceDataOut[] memory) {
    }
}
