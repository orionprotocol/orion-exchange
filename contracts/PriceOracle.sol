pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "./libs/EIP712Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./PriceOracleDataTypes.sol";

/**
 * @title PriceOracle
 * @dev Contract for storing and providing price data for the Orion Protocol
 * @dev Price oracle gets data from authorized source, store it and gives to Exchange.
 * @dev Initially there were three possible methods to provide price data
        1) signed data by oraclePublicKey
        2) data provided by authorized address
        3) chainlink
        Currently, first option is commented out.
 * @author @EmelyanenkoK
 */
contract PriceOracle is /* (SignedPriceApproach) EIP712Interface, */ Ownable, PriceOracleDataTypes {

    // Prices as they got to the contract
    struct Prices {
        address[] assetAddresses;
        uint64[] prices;
        uint64 timestamp;
        bytes signature;
    }

    /*bytes32 public constant PRICES_TYPEHASH = keccak256(
    /* SignedPriceApproach
    bytes32 public constant PRICES_TYPEHASH = keccak256(
        abi.encodePacked(
            "Prices(address[] assetAddresses,uint64[] prices,uint64 timestamp)"
        )
    );
    */

    // SignedPriceApproach, publicKey used to check data authenticity
    address public oraclePublicKey;
    // Asset related to which prices are determined, ORN in our case
    address public baseAsset;
    // Storage of prices
    mapping(address => PriceDataOut) public assetPrices;
    // Mapping of asset/eth chainLink price aggregators
    mapping(address => address) public chainLinkETHAggregator;
    // Mapping of proceProvider authorization: addresses with true may provide price data
    mapping(address => bool) public priceProviderAuthorization;

    constructor(address publicKey, address _baseAsset) public {
        require((publicKey != address(0)) && (_baseAsset != address(0)), "Wrong constructor params");
        oraclePublicKey = publicKey;
        baseAsset = _baseAsset;
    }

    /* SignedPriceApproach
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
       require(priceFeed.timestamp<block.timestamp+60, "Price data timestamp too far in the future");
       for(uint8 i=0; i<priceFeed.assetAddresses.length; i++) {
         PriceDataOut storage assetData = assetPrices[priceFeed.assetAddresses[i]];
         if(assetData.timestamp<priceFeed.timestamp) {
           assetData.price = priceFeed.prices[i];
           assetData.timestamp = priceFeed.timestamp;
         }
       }
    }
    */

    /**
     * @dev method to set price data to PriceOracle from one of authorized addresses
     * @param priceFeed - set of prices
     */
    function provideDataAddressAuthorization(Prices memory priceFeed) public {
       require(priceProviderAuthorization[msg.sender], "Unauthorized dataprovider");
       require(priceFeed.timestamp<block.timestamp+60, "Price data timestamp too far in the future");
       for(uint256 i=0; i<priceFeed.assetAddresses.length; i++) {
         PriceDataOut storage assetData = assetPrices[priceFeed.assetAddresses[i]];
         if(assetData.timestamp<priceFeed.timestamp) {
           assetData.price = priceFeed.prices[i];
           assetData.timestamp = priceFeed.timestamp;
         }
       }
    }

    /**
     * @dev price data getter (note prices are relative to basicAsset, ORN)
     * @param assetAddresses - set of assets
     * @return result PriceDataOut[] - set of prices
     */
    function givePrices(address[] calldata assetAddresses) external view returns (PriceDataOut[] memory result) {
      result = new PriceDataOut[](assetAddresses.length);
      for(uint256 i=0; i<assetAddresses.length; i++) {
        result[i] = assetPrices[assetAddresses[i]];
      }
    }

    /* SignedPriceApproach
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
    */

    /**
     * @dev Method to request price data from ChainLink aggregator
     * @dev note, ORN/ETH prices are requested by default since all other
            prices are calculated to ORN using ORN/ETH as base price.
            ChainLink aggregator prices should be already known at the moment.
     * @param assets - set of assets
     */
    function getChainLinkPriceData(address[] memory assets) public {
      // First request ORN/ETH, save it and then request all other assets to ETH
      // and calculate prices to ETH. Since ChainLink doesn't update prices
      // if they change less than threshold, regardless of provided Chainlink
      // timestamp we treat price as fresh (timestamp=now), but only during first
      // 24h. In any case, Chainlink should update price once in a day, even
      // if it didn't change; that way if provided price is older than 24h -
      // Chainlink aggregator doesn't work and in this case we will not set
      // outdated price as fresh.
      address baseAggregator = chainLinkETHAggregator[baseAsset];
      if(baseAggregator == address(0))
        return;
      (
          uint80 roundID,
          int _basePrice,
          uint startedAt,
          uint timestamp,
          uint80 answeredInRound
      ) = AggregatorV3Interface(baseAggregator).latestRoundData();
      uint now = block.timestamp;
      if(now - timestamp < 24 hours) {
        timestamp = now;
      }
      require(_basePrice>=0, "Negative base price is not allowed");
      uint basePrice = uint(_basePrice);

      //ETH/ORN
      PriceDataOut storage baseAssetData = assetPrices[address(0)];
      if(baseAssetData.timestamp<timestamp) {
          uint price = ( (10**AggregatorV3Interface(baseAggregator).decimals()) *1e8)/basePrice;
          require(price<2**64-1, "Too big price");
          baseAssetData.price = uint64(price);
          baseAssetData.timestamp = uint64(timestamp);
      }

      // Retrieve */ETH price data for all assets
      for(uint256 i=0; i<assets.length; i++) {
        address currentAsset = assets[i];
        address currentAggregator = chainLinkETHAggregator[currentAsset];
        if( currentAggregator == address(0))
          continue;
        (
            uint80 aRoundID,
            int _aPrice,
            uint aStartedAt,
            uint aTimestamp,
            uint80 aAnsweredInRound
        ) = AggregatorV3Interface(currentAggregator).latestRoundData();
        require(_aPrice>=0, "Negative price is not allowed");
        if(now - timestamp < 24 hours) {
          aTimestamp = now;
        }
        uint aPrice = uint(_aPrice);
        uint newTimestamp = timestamp > aTimestamp? aTimestamp : timestamp;

        PriceDataOut storage assetData = assetPrices[currentAsset];
        if(assetData.timestamp<newTimestamp) {
          uint price = (aPrice *1e8)/basePrice;
          require(price<2**64-1, "Too big price");
          assetData.price = uint64(price);
          assetData.timestamp = uint64(newTimestamp);
        }

      }
    }

    /**
     * @dev Method to update list of ChainLink aggregators
     * @param assets - set of assets
     * @param aggregatorAddresses - set of AggregatorV3Interface addresses
     * List of available aggregators: https://docs.chain.link/docs/ethereum-addresses
     */
    function setChainLinkAggregators(address[] memory assets, address[] memory aggregatorAddresses) public onlyOwner {
      for(uint256 i=0; i<assets.length; i++) {
        chainLinkETHAggregator[assets[i]] = aggregatorAddresses[i];
      }
    }

    /**
     * @dev Method to update list of autorized dataproviders
     * @param added - set of addresses for which we allow authorization
     * @param removed - set of addresses for which we forbid authorization
     */
    function changePriceProviderAuthorization(address[] memory added, address[] memory removed) public onlyOwner {
      for(uint256 i=0; i<added.length; i++) {
        priceProviderAuthorization[added[i]] = true;
      }
      for(uint256 i=0; i<removed.length; i++) {
        priceProviderAuthorization[removed[i]] = false;
      }
    }
}
