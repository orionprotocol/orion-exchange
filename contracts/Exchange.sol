pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Utils.sol";
import "./Staking.sol";
import "./PriceOracle.sol";
import "./libs/LibValidator.sol";

/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
contract Exchange is Utils, Staking, PriceOracle {
    using SafeMath for uint64;
    using LibValidator for LibValidator.Order;

    // EVENTS
    event NewAssetDeposit(
        address indexed user,
        address indexed assetAddress,
        uint256 amount
    );
    event NewAssetWithdrawl(
        address indexed user,
        address indexed assetAddress,
        uint256 amount
    );
    event NewTrade(
        address indexed buyer,
        address indexed seller,
        address baseAsset,
        address quoteAsset,
        uint256 filledPrice,
        uint256 filledAmount,
        uint256 amountQuote
    );
    event OrderUpdate(
        bytes32 orderHash,
        address indexed user,
        Status orderStatus
    );

    // GLOBAL VARIABLES

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade {
        uint256 filledPrice;
        uint256 filledAmount;
        uint256 feePaid;
        uint256 timestamp;
    }

    // Get trades by orderHash
    mapping(bytes32 => Trade[]) public trades;

    // Get trades by orderHash
    mapping(bytes32 => Status) public orderStatus;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint256)) private assetBalances;

    // MAIN FUNCTIONS

    constructor(address orionTokenAddress, address oraclePublicKey) public Staking(orionTokenAddress) PriceOracle(oraclePublicKey) {}

    /**
     * @dev Deposit ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     * @param amount asset amount to deposit in its base unit
     */
    function depositAsset(address assetAddress, uint256 amount) external {
        IERC20 asset = IERC20(assetAddress);
        require(asset.transferFrom(_msgSender(), address(this), amount), "E6");

        uint256 amountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );

        assetBalances[_msgSender()][assetAddress] = assetBalances[_msgSender()][assetAddress]
            .add(amountDecimal);

        emit NewAssetDeposit(_msgSender(), assetAddress, amountDecimal);
    }

    /**
     * @notice Deposit ETH to the exchange contract
     * @dev deposit event will be emitted with the amount in decimal format (10^8)
     * @dev balance will be stored in decimal format too
     */
    function deposit() external payable {
        require(msg.value > 0);

        uint256 amountDecimal = LibUnitConverter.baseUnitToDecimal(
            address(0),
            msg.value
        );

        assetBalances[_msgSender()][address(
            0
        )] = assetBalances[_msgSender()][address(0)].add(amountDecimal);

        emit NewAssetDeposit(_msgSender(), address(0), amountDecimal);
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     * @param assetAddress address of the asset to withdraw
     * @param amount asset amount to withdraw in its base unit
     */
    function withdraw(address assetAddress, uint256 amount)
        external
        nonReentrant
    {
        uint256 amountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );

        assetBalances[_msgSender()][assetAddress] = assetBalances[_msgSender()][assetAddress]
            .sub(amountDecimal);

        safeTransfer(_msgSender(), assetAddress, amountDecimal);

        emit NewAssetWithdrawl(_msgSender(), assetAddress, amountDecimal);
    }

    /**
     * @dev Get asset balance for a specific address
     * @param assetAddress address of the asset to query
     * @param user user address to query
     */
    function getBalance(address assetAddress, address user)
        public
        view
        returns (uint256 assetBalance)
    {
        return assetBalances[user][assetAddress];
    }

    /**
     * @dev Batch query of asset balances for a user
     * @param assetsAddresses array of addresses of teh assets to query
     * @param user user address to query
     */
    function getBalances(address[] memory assetsAddresses, address user)
        public
        view
        returns (uint256[] memory)
    {
        uint256[] memory balances = new uint256[](assetsAddresses.length);
        for (uint256 i = 0; i < assetsAddresses.length; i++) {
            balances[i] = assetBalances[user][assetsAddresses[i]];
        }
        return balances;
    }

    /**
     * @dev get trades for a specific order
     */
    function getOrderTrades(LibValidator.Order memory order)
        public
        view
        returns (Trade[] memory)
    {
        bytes32 orderHash = order.getTypeValueHash();
        return trades[orderHash];
    }

    /**
     * @dev get trades for a specific order
     */
    function getFilledAmounts(LibValidator.Order memory order)
        public
        view
        returns (uint256 totalFilled, uint256 totalFeesPaid)
    {
        bytes32 orderHash = order.getTypeValueHash();
        Trade[] memory orderTrades = trades[orderHash];

        for (uint256 i = 0; i < orderTrades.length; i++) {
            totalFilled = totalFilled.add(trades[orderHash][i].filledAmount);
            totalFeesPaid = totalFeesPaid.add(trades[orderHash][i].feePaid);
        }
    }

    /**
     * @dev get trades for a specific order
     */
    function getOrderStatus(LibValidator.Order memory order)
        public
        view
        returns (Status status)
    {
        bytes32 orderHash = order.getTypeValueHash();
        return orderStatus[orderHash];
    }

    /**
     * @notice Settle a trade with two orders, filled price and amount
     * @dev 2 orders are submitted, it is necessary to match them:
        check conditions in orders for compliance filledPrice, filledAmountbuyOrderHash
        change balances on the contract respectively with buyer, seller, matcbuyOrderHashher
     * @param buyOrder structure of buy side orderbuyOrderHash
     * @param sellOrder structure of sell side order
     * @param filledPrice price at which the order was settled
     * @param filledAmount amount settled between orders
     */
    function fillOrders(
        LibValidator.Order memory buyOrder,
        LibValidator.Order memory sellOrder,
        uint256 filledPrice,
        uint256 filledAmount
    ) public nonReentrant {
        // --- VARIABLES --- //

        // Amount of quote asset
        uint256 amountQuote = filledAmount.mul(filledPrice).div(10**8);

        // Order Hashes
        bytes32 buyOrderHash = buyOrder.getTypeValueHash();
        bytes32 sellOrderHash = sellOrder.getTypeValueHash();

        // --- VALIDATIONS --- //

        // Validate signatures using eth typed sign V1
        require(
            LibValidator.checkOrdersInfo(
                buyOrder,
                sellOrder,
                _msgSender(),
                filledAmount,
                filledPrice,
                now
            ),
            "E3"
        );

        // Check if orders were not cancelled
        require(!isOrderCancelled(buyOrderHash), "E4");
        require(!isOrderCancelled(sellOrderHash), "E4");

        // --- UPDATES --- //

        // Update User's balances
        updateOrderBalance(buyOrder, filledAmount, amountQuote, true);
        updateOrderBalance(sellOrder, filledAmount, amountQuote, false);

        // Update trades
        updateTrade(buyOrderHash, buyOrder, filledAmount, filledPrice);
        updateTrade(sellOrderHash, sellOrder, filledAmount, filledPrice);

        emit NewTrade(
            buyOrder.senderAddress,
            sellOrder.senderAddress,
            buyOrder.baseAsset,
            buyOrder.quoteAsset,
            filledPrice,
            filledAmount,
            amountQuote
        );
    }

    /**
     * @notice check if order was cancelled
     */
    function isOrderCancelled(bytes32 orderHash) public view returns (bool) {
        // Check if order was not cancelled
        if (
            orderStatus[orderHash] == Status.CANCELLED ||
            orderStatus[orderHash] == Status.PARTIALLY_CANCELLED
        ) return true;

        return false;
    }

    function validateOrder(LibValidator.Order memory order)
        public
        pure
        returns (bool isValid)
    {
        isValid = LibValidator.validateV3(order);
    }

    /**
     *  @notice update user balances and send matcher fee
     *  @param isBuyer boolean, indicating true if the update is for buyer, false for seller
     */
    function updateOrderBalance(
        LibValidator.Order memory order,
        uint256 filledAmount,
        uint256 amountQuote,
        bool isBuyer
    ) internal {
        address user = order.senderAddress;
        uint256 baseBalance = assetBalances[user][order.baseAsset];
        uint256 quoteBalance = assetBalances[user][order.quoteAsset];
        uint256 matcherFee = order.matcherFee.mul(filledAmount).div(
            order.amount
        );

        if (isBuyer) {
            // Update Buyer's Balance (- quoteAsset + baseAsset  )
            assetBalances[user][order.quoteAsset] = quoteBalance.sub(
                amountQuote
            );
            assetBalances[user][order.baseAsset] = baseBalance.add(
                filledAmount
            );
        } else {
            // Update Seller's Balance  (+ quoteAsset - baseAsset   )
            assetBalances[user][order.quoteAsset] = quoteBalance.add(
                amountQuote
            );
            assetBalances[user][order.baseAsset] = baseBalance.sub(
                filledAmount
            );
        }

        // User pay for fees
        assetBalances[user][order.matcherFeeAsset] = assetBalances[user][order
            .matcherFeeAsset]
            .sub(matcherFee);
        safeTransfer(order.matcherAddress, order.matcherFeeAsset, matcherFee);
    }

    /**
     *  @notice Store trade and update order
     */
    function updateTrade(
        bytes32 orderHash,
        LibValidator.Order memory order,
        uint256 filledAmount,
        uint256 filledPrice
    ) internal {
        uint256 matcherFee = order.matcherFee.mul(filledAmount).div(
            order.amount
        );

        (uint256 totalFilled, uint256 totalFeesPaid) = getFilledAmounts(order);

        require(totalFilled.add(filledAmount) <= order.amount, "E3");
        require(totalFeesPaid.add(matcherFee) <= order.matcherFee, "E3");

        Status status = Status.NEW;

        if (
            totalFilled.add(filledAmount) < order.amount &&
            trades[orderHash].length > 1
        ) status = Status.PARTIALLY_FILLED;
        if (totalFilled.add(filledAmount) == order.amount)
            status = Status.FILLED;

        //Update order status in storage
        orderStatus[orderHash] = status;

        // Store Trade
        trades[orderHash].push(
            Trade(filledPrice, filledAmount, matcherFee, now)
        );

        emit OrderUpdate(orderHash, order.senderAddress, status);
    }

    /**
     * @notice users can cancel an order
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(LibValidator.Order memory order) public nonReentrant {
        require(order.validateV3(), "E2");
        require(_msgSender() == order.senderAddress, "Not owner");

        bytes32 orderHash = order.getTypeValueHash();

        require(!isOrderCancelled(orderHash), "E4");

        (
            uint256 totalFilled, /*uint totalFeesPaid*/

        ) = getFilledAmounts(order);

        if (totalFilled > 0)
            orderStatus[orderHash] = Status.PARTIALLY_CANCELLED;
        else orderStatus[orderHash] = Status.CANCELLED;

        emit OrderUpdate(orderHash, _msgSender(), orderStatus[orderHash]);

        assert(
            orderStatus[orderHash] == Status.PARTIALLY_CANCELLED ||
                orderStatus[orderHash] == Status.CANCELLED
        );
    }

    /**
     *  @dev  revert on fallback function
     */
    function() external {
        revert("E6");
    }

    /* Error Codes

        E1: Insufficient Balance,
        E2: Invalid Signature,
        E3: Invalid Order Info,
        E4: Order cancelled or expired,
        E5: Contract not active,
        E6: Transfer error
    */
}
