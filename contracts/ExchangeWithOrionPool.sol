// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "./Exchange.sol";
import "./interfaces/IPoolSwapCallback.sol";
import "./interfaces/IPoolFunctionality.sol";
import "./utils/orionpool/periphery/interfaces/IOrionPoolV2Router02Ext.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract ExchangeWithOrionPool is Exchange, IPoolSwapCallback {

    using SafeERC20 for IERC20;

    address public _orionpoolRouter;
    mapping (address => bool) orionpoolAllowances;

    address public WETH;

    modifier initialized {
        require(address(_orionToken)!=address(0), "E16I");
        require(_oracleAddress!=address(0), "E16I");
        require(_allowedMatcher!=address(0), "E16I");
        require(_orionpoolRouter!=address(0), "E16I");
        _;
    }

    /**
     * @dev set basic Exchange params
     * @param orionToken - base token address
     * @param priceOracleAddress - adress of PriceOracle contract
     * @param allowedMatcher - address which has authorization to match orders
     * @param orionpoolRouter - OrionPool Functionality contract address for changes through orionpool
     */
    function setBasicParams(
        address orionToken,
        address priceOracleAddress,
        address allowedMatcher,
        address orionpoolRouter
    ) public onlyOwner {
        _orionToken = IERC20(orionToken);
        _oracleAddress = priceOracleAddress;
        _allowedMatcher = allowedMatcher;
        _orionpoolRouter = orionpoolRouter;
        WETH = IPoolFunctionality(_orionpoolRouter).getWETH();
    }

    //Important catch-all a function that should only accept ethereum and don't allow do something with it
    //We accept ETH there only from out router or wrapped ethereum contract.
    //If router sends some ETH to us - it's just swap completed, and we don't need to do something
    receive() external payable {
        require(msg.sender == _orionpoolRouter || msg.sender == WETH, "NPF");
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
        uint filledBase;
        uint filledQuote;
        uint filledPrice;
        uint amount_spend;
        uint amount_receive;
        uint amountQuote;
        bool isInContractTrade;
        bool isRetainFee;
    }

    function fillThroughOrionPool(
        LibValidator.Order memory order,
        uint112 filledAmount,
        uint64 blockchainFee,
        address[] calldata path
    ) public nonReentrant initialized {

        LibValidator.checkOrderSingleMatch(order, msg.sender, _allowedMatcher, filledAmount,
            block.timestamp, path, order.buySide);

        OrderExecutionData memory tmp;
        bool isSeller = order.buySide == 0;

        tmp.amountQuote = uint(filledAmount) * order.price / (10**8);
        (tmp.amount_spend, tmp.amount_receive) = isSeller ? (uint(filledAmount), tmp.amountQuote)
        : (tmp.amountQuote, uint(filledAmount));

        tmp.isInContractTrade = path[0] == address(0) || getBalance(path[0], order.senderAddress) > 0;
        tmp.isRetainFee = !tmp.isInContractTrade && order.matcherFeeAsset == path[path.length-1];

        try IPoolFunctionality(_orionpoolRouter).doSwapThroughOrionPool(
            tmp.isInContractTrade ? address(this) : order.senderAddress,
            uint112(tmp.amount_spend),
            uint112(tmp.amount_receive),
            path,
            isSeller ? true : false,
            (tmp.isInContractTrade || tmp.isRetainFee) ? address(this) : order.senderAddress
        ) returns(uint amountOut, uint amountIn) {
            (tmp.filledBase, tmp.filledQuote) = isSeller ? (amountOut, amountIn) : (amountIn, amountOut);
            tmp.filledPrice = tmp.filledQuote * (10**8) / tmp.filledBase;

            if (isSeller) {
                require(tmp.filledPrice >= order.price, "EX");
            } else {
                require(tmp.filledPrice<= order.price, "EX");
            }

            //  Change fee only after order validation
            if (blockchainFee < order.matcherFee)
                order.matcherFee = blockchainFee;

            if (tmp.isInContractTrade) {
                (uint tradeType, int actualIn) = updateOrderBalanceDebit(order, uint112(tmp.filledBase),
                    uint112(tmp.filledQuote), isSeller ? kSell : kBuy);
                creditUserAssets(tradeType, order.senderAddress, actualIn, path[path.length-1]);

            } else {
                _payMatcherFee(order.senderAddress, order.matcherFeeAsset, order.matcherAddress, uint(order.matcherFee));
                if (tmp.isRetainFee) {
                    creditUserAssets(1, order.senderAddress, int(amountIn), path[path.length-1]);
                }
            }
        } catch(bytes memory) {
            tmp.filledBase = 0;
            tmp.filledPrice = order.price;
            _payMatcherFee(order.senderAddress, order.matcherFeeAsset, order.matcherAddress, uint(order.matcherFee));
        }

        {   //  STack too deep workaround
            require(checkPosition(order.senderAddress), tmp.isInContractTrade ? (isSeller ? "E1PS" : "E1PB") : "E1PF");
            bytes32 orderHash = LibValidator.getTypeValueHash(order);
            uint192 total_amount = filledAmounts[orderHash];
            total_amount += uint112(tmp.filledBase); //it is safe to add ui112 to each other to get i192
            require(total_amount >= tmp.filledBase, "E12B_0");
            require(total_amount <= order.amount, "E12B");
            filledAmounts[orderHash] = total_amount;
        }

        emit NewTrade(
            order.senderAddress,
            address(1),
            order.baseAsset,
            order.quoteAsset,
            uint64(tmp.filledPrice),
            uint192(tmp.filledBase),
            uint192(tmp.filledQuote)
        );

    }

    function _payMatcherFee(
        address user,
        address feeAsset,
        address matcher,
        uint feeAmount
    ) internal {
        _updateBalance(user, feeAsset, -1*int(feeAmount));
        _updateBalance(matcher, feeAsset, int(feeAmount));
    }

    function safeAutoTransferFrom(address token, address from, address to, uint value) override external {
        require(msg.sender == _orionpoolRouter, "Only _orionpoolRouter allowed");
        SafeTransferHelper.safeAutoTransferFrom(WETH, token, from, to, value);
    }

    function swapThroughOrionPool(
        uint112     amount_spend,
        uint112     amount_receive,
        address[] calldata   path,
        bool        is_exact_spend
    ) public payable nonReentrant initialized {
        bool isInContractTrade = getBalance(path[0], msg.sender) > 0;
        bool isSentETHEnough;
        if (msg.value > 0) {
            uint112 eth_sent = uint112(LibUnitConverter.baseUnitToDecimal(address(0), msg.value));
            if (path[0] == address(0) && eth_sent >= amount_spend) {
                isSentETHEnough = true;
                isInContractTrade = false;
            } else {
                _updateBalance(msg.sender, address(0), eth_sent);
            }
        }

        (uint amountOut, uint amountIn) = IPoolFunctionality(_orionpoolRouter).doSwapThroughOrionPool(
            isInContractTrade || isSentETHEnough ? address(this) : msg.sender,
            amount_spend,
            amount_receive,
            path,
            is_exact_spend,
            isInContractTrade ? address(this) : msg.sender
        );

        if (isSentETHEnough) {
            uint actualOutBaseUnit = uint(LibUnitConverter.decimalToBaseUnit(address(0), amountOut));
            if (msg.value > actualOutBaseUnit) {
                SafeTransferHelper.safeTransferTokenOrETH(address(0), msg.sender, msg.value - actualOutBaseUnit);
            }
        } else if (isInContractTrade) {
            _updateBalance(msg.sender, path[0], -1*int256(amountOut));
            _updateBalance(msg.sender, path[path.length-1], int(amountIn));
            require(checkPosition(msg.sender), "E1PS");
        }
    }
}

