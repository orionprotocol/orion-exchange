pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./utils/orionpool/periphery/interfaces/IOrionPoolV2Router02Ext.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


contract ExchangeWithOrionPool is Exchange {

    using SafeERC20 for IERC20;

    address public _orionpoolRouter;
    mapping (address => bool) orionpoolAllowances;

    modifier initialized {
        require(_orionpoolRouter!=address(0), "_orionpoolRouter is not set");
        require(address(_orionToken)!=address(0), "_orionToken is not set");
        require(_oracleAddress!=address(0), "_oracleAddress is not set");
        require(_allowedMatcher!=address(0), "_allowedMatcher is not set");
        _;
    }

    function _safeIncreaseAllowance(address token) internal
    {
        if(token != address(0) && !orionpoolAllowances[token])
        {
            IERC20(token).safeIncreaseAllowance(_orionpoolRouter, 2**256-1);
            orionpoolAllowances[token] = true;
        }
    }

    /**
     * @dev set basic Exchange params
     * @param orionToken - base token address
     * @param priceOracleAddress - adress of PriceOracle contract
     * @param allowedMatcher - address which has authorization to match orders
     * @param orionpoolRouter - OrionPool Router address for changes through orionpool
     */
    function setBasicParams(address orionToken,
                            address priceOracleAddress,
                            address allowedMatcher,
                            address orionpoolRouter)
             public onlyOwner
             {
      _orionToken = IERC20(orionToken);
      _oracleAddress = priceOracleAddress;
      _allowedMatcher = allowedMatcher;
      _orionpoolRouter = orionpoolRouter;
    }

    //  Important catch-all afunction that should only accept ethereum and don't allow do something with it
    //      We accept ETH there only from out router.
    //      If router sends some ETH to us - it's just swap completed, and we don't need to do smth
    //      with ETH received - amount of ETH will be handled by ........... blah blah
    receive() external payable
    {
        require(msg.sender == _orionpoolRouter, "NPF");
    }

    /**
     * @notice (partially) settle buy order with OrionPool as counterparty
     * @dev order and orionpool path are submitted, it is necessary to match them:
        check conditions in order for compliance filledPrice and filledAmount
        change tokens via OrionPool
        check that final price after exchange not worse than specified in order
        change balances on the contract respectively
     * @param order structure of buy side orderbuyOrderHash
     * @param filledAmount amount of purchaseable token
     * @param path array of assets addresses (each consequent asset pair is change pair)
     */

    //  Just to avoid stack too deep error;
    struct OrderExecutionData
    {
        uint64      filledPrice;
        uint112     amountQuote;
    }

    function fillThroughOrionPool(
            LibValidator.Order memory order,
            uint112 filledAmount,
            uint64 blockchainFee,
            address[] calldata path
        ) public nonReentrant initialized {
        // Amount of quote asset
        uint256 _amountQuote = uint256(filledAmount)* order.price/(10**8);
        OrderExecutionData memory exec_data;

        if(order.buySide==1){ /* NOTE BUY ORDER ************************************************************/
            (int112 amountQuoteBaseUnits, int112 filledAmountBaseUnits) =
            (
                LibUnitConverter.decimalToBaseUnit(path[0], _amountQuote),
                LibUnitConverter.decimalToBaseUnit(path[path.length-1], filledAmount)
            );

            //  TODO: check
            //  require(IERC20(order.quoteAsset).balanceOf(address(this)) >= uint(amountQuoteBaseUnits), "NEGT");

            LibValidator.checkOrderSingleMatch(order, msg.sender, _allowedMatcher, filledAmount, block.timestamp, path, 1);

            //  Change fee only after order validation
            if(blockchainFee < order.matcherFee)
                order.matcherFee = blockchainFee;

            _safeIncreaseAllowance(order.quoteAsset);
            try IOrionPoolV2Router02Ext(_orionpoolRouter).swapTokensForExactTokensAutoRoute(
                                                        uint(filledAmountBaseUnits),
                                                        uint(amountQuoteBaseUnits),
                                                        path,
                                                        address(this)) //  order.expiration/1000
            returns(uint[] memory amounts)
            {
                exec_data.amountQuote = uint112(LibUnitConverter.baseUnitToDecimal(
                        path[0],
                        amounts[0]
                    ));

                //require(_amountQuote<2**112-1, "E12G"); //TODO
                uint256 _filledPrice = exec_data.amountQuote*(10**8)/filledAmount;
                require(_filledPrice<= order.price, "EX"); //TODO
                exec_data.filledPrice = uint64(_filledPrice); // since _filledPrice<buyOrder.price it fits uint64
                //uint112 amountQuote = uint112(_amountQuote);
            }
            catch(bytes memory)
            {
                filledAmount = 0;
                exec_data.filledPrice = order.price;
            }

            // Update User's balances
            updateOrderBalance(order, filledAmount, exec_data.amountQuote, kBuy);
            require(checkPosition(order.senderAddress), "Incorrect margin position for buyer");


        }else{ /* NOTE: SELL ORDER **************************************************************************/
            LibValidator.checkOrderSingleMatch(order, msg.sender, _allowedMatcher, filledAmount, block.timestamp, path, 0);

            //  Change fee only after order validation
            if(blockchainFee < order.matcherFee)
                order.matcherFee = blockchainFee;

            (int112 amountQuoteBaseUnits, int112 filledAmountBaseUnits) =
            (
                LibUnitConverter.decimalToBaseUnit(path[0], filledAmount),
                LibUnitConverter.decimalToBaseUnit(path[path.length-1], _amountQuote)
            );

            _safeIncreaseAllowance(order.baseAsset);
            try IOrionPoolV2Router02Ext(_orionpoolRouter).swapExactTokensForTokensAutoRoute(
                uint(amountQuoteBaseUnits),
                uint(filledAmountBaseUnits),
                path,
                address(this))  //    order.expiration/1000)
            returns (uint[] memory amounts)
            {
                exec_data.amountQuote = uint112(LibUnitConverter.baseUnitToDecimal(
                        path[path.length-1],
                        amounts[path.length-1]
                    ));
                //require(_amountQuote<2**112-1, "E12G"); //TODO
                uint256 _filledPrice = exec_data.amountQuote*(10**8)/filledAmount;
                require(_filledPrice>= order.price, "EX"); //TODO
                exec_data.filledPrice = uint64(_filledPrice); // since _filledPrice<buyOrder.price it fits uint64
                //uint112 amountQuote = uint112(_amountQuote);
            }
            catch(bytes memory)
            {
                filledAmount = 0;
                exec_data.filledPrice = order.price;
            }

            // Update User's balances
            updateOrderBalance(order, filledAmount, exec_data.amountQuote, kSell);
            require(checkPosition(order.senderAddress), "Incorrect margin position for seller");
        }

        {   //  STack too deep workaround
            bytes32 orderHash = LibValidator.getTypeValueHash(order);
            uint192 total_amount = filledAmounts[orderHash];
            //  require(filledAmounts[orderHash]==0, "filledAmount already has some value"); //  Old way
            total_amount += filledAmount; //it is safe to add ui112 to each other to get i192
            require(total_amount >= filledAmount, "E12B_0");
            require(total_amount <= order.amount, "E12B");
            filledAmounts[orderHash] = total_amount;
        }

        emit NewTrade(
            order.senderAddress,
            address(1), //TODO //sellOrder.senderAddress,
            order.baseAsset,
            order.quoteAsset,
            exec_data.filledPrice,
            filledAmount,
            exec_data.amountQuote
        );

    }

    /*
        BUY LIMIT ORN/USDT
         path[0] = USDT
         path[1] = ORN
         is_exact_spend = false;

        SELL LIMIT ORN/USDT
         path[0] = ORN
         path[1] = USDT
         is_exact_spend = true;
    */

    event NewSwapOrionPool
    (
        address user,
        address asset_spend,
        address asset_receive,
        int112 amount_spent,
        int112 amount_received
    );

    function swapThroughOrionPool(
        uint112     amount_spend,
        uint112     amount_receive,
        address[] calldata   path,
        bool        is_exact_spend
    ) public nonReentrant initialized
    {
        (int112 amount_spend_base_units, int112 amount_receive_base_units) =
        (
            LibUnitConverter.decimalToBaseUnit(path[0], amount_spend),
            LibUnitConverter.decimalToBaseUnit(path[path.length-1], amount_receive)
        );

        //  Checks
        require(getBalance(path[0], msg.sender) >= amount_spend, "NEGS1");

        _safeIncreaseAllowance(path[0]);

        uint256 tx_value = path[0] == address(0) ? uint(amount_spend_base_units) : 0;

        uint[] memory amounts = is_exact_spend ?
        IOrionPoolV2Router02Ext(_orionpoolRouter).swapExactTokensForTokensAutoRoute
        {value: tx_value}
        (
            uint(amount_spend_base_units),
            uint(amount_receive_base_units),
            path,
            address(this)
        )
        :
        IOrionPoolV2Router02Ext(_orionpoolRouter).swapTokensForExactTokensAutoRoute
        {value: tx_value}
        (
            uint(amount_receive_base_units),
            uint(amount_spend_base_units),
            path,
            address(this)
        );

        //  Anyway user gave amounts[0] and received amounts[len-1]
        int112 amount_actually_spent = LibUnitConverter.baseUnitToDecimal(path[0], amounts[0]);
        int112 amount_actually_received = LibUnitConverter.baseUnitToDecimal(path[path.length-1], amounts[path.length-1]);

        int192 balance_in_spent = assetBalances[msg.sender][path[0]];
        require(amount_actually_spent >= 0 && balance_in_spent >= amount_actually_spent, "NEGS2_1");
        balance_in_spent -= amount_actually_spent;
        assetBalances[msg.sender][path[0]] = balance_in_spent;
        require(checkPosition(msg.sender), "NEGS2_2");

        address receiving_token = path[path.length - 1];
        int192 balance_in_received = assetBalances[msg.sender][receiving_token];
        bool is_need_update_liability = (balance_in_received < 0);
        balance_in_received += amount_actually_received;
        require(amount_actually_received >= 0 /* && balance_in_received >= amount_actually_received*/ , "NEGS2_3");
        assetBalances[msg.sender][receiving_token] = balance_in_received;

        if(is_need_update_liability)
            MarginalFunctionality.updateLiability(
                msg.sender,
                receiving_token,
                liabilities,
                uint112(amount_actually_received),
                assetBalances[msg.sender][receiving_token]
            );

        //  TODO: remove
        emit NewSwapOrionPool
        (
            msg.sender,
            path[0],
            receiving_token,
            amount_actually_spent,
            amount_actually_received
        );
    }

    function increaseAllowance(address token) public
    {
        IERC20(token).safeIncreaseAllowance(_orionpoolRouter, 2**256-1);
        orionpoolAllowances[token] = true;
    }
}

