pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
contract PriceOracleInterface {
    struct PriceDataOut {
        uint64 price;
        uint64 timestamp;
    }
  function givePrices(address[] calldata assetAddresses) external view returns (PriceDataOut[] memory) {
  }
}
