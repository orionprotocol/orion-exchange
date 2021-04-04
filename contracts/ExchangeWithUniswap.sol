pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./utils/uniswap/periphery/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract ExchangeWithUniswap is Exchange {

    using SafeERC20 for IERC20;

    address _uniswapRouter;
    mapping (address => bool) uniswapAllowances;


    /**
     * @dev set basic Exchange params
     * @param orionToken - base token address
     * @param priceOracleAddress - adress of PriceOracle contract
     * @param allowedMatcher - address which has authorization to match orders
     * @param uniswapRouter - Uniswap Router address for changes through uniswap
     */
    function setBasicParams(address orionToken,
                            address priceOracleAddress, 
                            address allowedMatcher,
                            address uniswapRouter) 
             public onlyOwner 
             {
      require(orionToken != address(0) && priceOracleAddress != address(0) && uniswapRouter != address(0), "E15");
      _orionToken = IERC20(orionToken);
      _oracleAddress = priceOracleAddress;
      _allowedMatcher = allowedMatcher;
      _uniswapRouter = uniswapRouter;
    }


    /**
     * @notice (partially) settle buy order with Uniswap as counterparty
     * @dev order and uniswap path are submitted, it is necessary to match them:
        check conditions in order for compliance filledPrice and filledAmount
        change tokens via Uniswap
        check that final price after exchange not worse than specified in order
        change balances on the contract respectively       
     * @param buyOrder structure of buy side orderbuyOrderHash
     * @param filledAmount amount of purchaseable token
     * @param path array of assets addresses (each consequent asset pair is change pair)
     */
    function fillThroughUniswap(
            LibValidator.Order memory buyOrder,
            uint112 filledAmount,
            address[] memory path
        ) public nonReentrant {
        // Amount of quote asset
        uint256 _amountQuote = uint256(filledAmount)*buyOrder.price/(10**8);

        bytes32 buyOrderHash = LibValidator.getTypeValueHash(buyOrder);
        LibValidator.checkOrderSingleMatch(buyOrder, msg.sender, _allowedMatcher, filledAmount, block.timestamp, path);
        /*
        
        // Validate signatures and order
        require(LibValidator.validateV3(buyOrder), "E2B");
        require(buyOrder.matcherAddress == msg.sender && buyOrder.matcherAddress == _allowedMatcher, "E3M2");
        require(
            buyOrder.baseAsset == path[path.length-1] &&
            buyOrder.quoteAsset == path[0],
            "E3As"
        );
        require(filledAmount <= buyOrder.amount, "E3AmB");
        require(buyOrder.expiration/1000 >= block.timestamp, "E4B");
        require( buyOrder.buySide==1, "E3D");
        */

        //updateFilledAmount
        filledAmounts[buyOrderHash] += filledAmount; //it is safe to add ui112 to each other to get i192
        require(filledAmounts[buyOrderHash] <= buyOrder.amount, "E12B");

        
        if(!uniswapAllowances[buyOrder.quoteAsset]) {
            IERC20(buyOrder.quoteAsset).safeIncreaseAllowance(_uniswapRouter, 2**256-1);
            uniswapAllowances[buyOrder.quoteAsset] = true;
        }

        (int112 amountQuoteBaseUnits, int112 filledAmoutBaseUnits) = 
          (
            LibUnitConverter.decimalToBaseUnit(path[0], _amountQuote),
            LibUnitConverter.decimalToBaseUnit(path[path.length-1], filledAmount)
          );
        uint[] memory amounts = IUniswapV2Router02(_uniswapRouter)
                                                  .swapTokensForExactTokens(
                                                   uint(filledAmoutBaseUnits),
                                                   uint(amountQuoteBaseUnits),
                                                   path,
                                                   address(this),
                                                   buyOrder.expiration/1000);

        uint112 amountQuote = uint112(LibUnitConverter.baseUnitToDecimal(
            path[0],
            amounts[0]
        ));
        //require(_amountQuote<2**112-1, "E12G"); //TODO
        uint256 _filledPrice = amountQuote*(10**8)/filledAmount;
        require(_filledPrice<=buyOrder.price, "EX"); //TODO
        uint64 filledPrice = uint64(_filledPrice); // since _filledPrice<buyOrder.price it fits uint64
        //uint112 amountQuote = uint112(_amountQuote);

        // Update User's balances
        updateOrderBalance(buyOrder, filledAmount, amountQuote, true);
        require(checkPosition(buyOrder.senderAddress), "Incorrect margin position for buyer");

        emit NewTrade(
            buyOrder.senderAddress,
            address(1), //TODO //sellOrder.senderAddress,
            buyOrder.baseAsset,
            buyOrder.quoteAsset,
            filledPrice,
            filledAmount,
            amountQuote
        );
    }

}

