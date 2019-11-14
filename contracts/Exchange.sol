pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './Utils.sol';
import './Validators/ValidatorV1.sol';


/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
contract Exchange is Ownable, Utils, ValidatorV1{

    // using SafeMath for uint;
    using SafeMath for uint64;

    // EVENTS
    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);
    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);
    event NewTrade(address indexed buyer, address indexed seller, address baseAsset,
        address quoteAsset, uint filledPrice, uint filledAmount, uint amountQuote);
    event OrderCancelled(bytes32 indexed orderHash, address cancelledBy);


    // GLOBAL VARIABLES

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade{
        bytes32 orderHash;
        Status orderStatus;
        uint amount;
    }

    // Get trades by orderHash
    mapping(bytes32 => Trade[]) public trades;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint)) public assetBalances;

    // Check if an order was cancelled
    mapping(bytes32 => bool) public cancelledOrders;

    // Pause or unpause exchangebuyOrderHash
    bool public isActive = true;


    // MODIFIERS

    /**
     * @dev prevents people from using the exchange if not active
     */
    modifier onlyActive() {
        require(isActive, "contract is not active");
        _;
    }


    // MAIN FUNCTIONS

    /**
     * @dev Deposit ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     * @param amount asset amount to deposit in its base unit
     */
    function depositAsset(address assetAddress, uint amount) public onlyActive{
        IERC20 asset = IERC20(assetAddress);
        require(asset.transferFrom(_msgSender(), address(this), amount), "error transfering asset to exchange");

        uint amountDecimal = baseUnitToDecimal(assetAddress, amount);

        assetBalances[_msgSender()][assetAddress] = assetBalances[_msgSender()][assetAddress].add(amountDecimal);

        emit NewAssetDeposit(_msgSender(), assetAddress, amountDecimal);
    }

    /**
     * @notice Deposit WAN to the exchange contract
     * @dev deposit event will be emitted with the amount in decimal format (10^8)
     * @dev balance will be stored in decimal format too
     */
    function depositWan() public payable onlyActive{
        require(msg.value > 0, "invalid amount sent");

        uint amountDecimal = baseUnitToDecimal(address(0), msg.value);

        assetBalances[_msgSender()][address(0)] = assetBalances[_msgSender()][address(0)].add(amountDecimal);

        emit NewAssetDeposit(_msgSender(), address(0), amountDecimal);
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     * @param assetAddress address of the asset to withdraw
     * @param amount asset amount to withdraw in its base unit
     */
    function withdraw(address assetAddress, uint amount) external nonReentrant {
        uint amountDecimal = baseUnitToDecimal(assetAddress, amount);
        require(assetBalances[_msgSender()][assetAddress] >= amountDecimal, "not enough funds to withdraw");

        assetBalances[_msgSender()][assetAddress] = assetBalances[_msgSender()][assetAddress].sub(amountDecimal);

        safeTransfer(_msgSender(), assetAddress, amountDecimal);

        emit NewAssetWithdrawl(_msgSender(), assetAddress, amountDecimal);
    }


    /**
     * @dev Get asset balance for a specific address
     * @param assetAddress address of the asset to query
     * @param user user address to query
     */
    function getBalance(address assetAddress, address user) public view returns(uint assetBalance){
        return assetBalances[user][assetAddress];
    }

    /**
     * @dev Batch query of asset balances for a user
     * @param assetsAddresses array of addresses of teh assets to query
     * @param user user address to query
     */
    function getBalances(address[] memory assetsAddresses, address user) public view returns(uint[] memory){
        uint[] memory balances = new uint[](assetsAddresses.length);
        for(uint i = 0; i < assetsAddresses.length; i++){
            balances[i] = assetBalances[user][assetsAddresses[i]];
        }
        return balances;
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
        Order memory buyOrder, Order memory sellOrder,
        uint filledPrice, uint filledAmount
    )
        public
        onlyActive
        nonReentrant
    {

        // --- VARIABLES --- //

        // Amount of quote asset
        uint amountQuote = filledAmount.mul(filledPrice).div(10**8);

        // Parties
        address buyer = buyOrder.senderAddress;
        address seller = sellOrder.senderAddress;

        // Order Hashes
        bytes32 buyOrderHash = getTypeValueHash(buyOrder);
        bytes32 sellOrderHash = getTypeValueHash(sellOrder);

         // --- VALIDATIONS --- //

        // Validate Order Content
        _validateOrdersInfo(buyOrder, sellOrder, filledPrice, filledAmount);

        // Check if orders were not cancelled
        require(!cancelledOrders[buyOrderHash], "buy order was cancelled");
        require(!cancelledOrders[sellOrderHash], "sell order was cancelled");

        // --- UPDATES --- //

        // Update User's balances
        updateBuyerBalance(buyOrder, filledAmount, amountQuote);
        updateSellerBalance(sellOrder, filledAmount, amountQuote);

        // Update trades
        updateTrade(buyOrderHash, buyOrder.amount, filledAmount);
        updateTrade(sellOrderHash, sellOrder.amount, filledAmount);

        emit NewTrade(buyer, seller, buyOrder.baseAsset, buyOrder.quoteAsset, filledPrice, filledAmount, amountQuote);

    }

    /**
        @notice Orders values checks
        @dev helper function to validate orders
     */
    function _validateOrdersInfo(
        Order memory buyOrder, Order memory sellOrder,
        uint filledPrice, uint filledAmount
    ) internal view{

        // Validate signatures using eth typed sign V1
        require(validateV1(buyOrder), "Invalid signature for Buy order");
        require(validateV1(sellOrder), "Invalid signature for Sell order");

        // Same matcher address
        require(buyOrder.matcherAddress == _msgSender() && sellOrder.matcherAddress == _msgSender(), "incorrect matcher address");

        // Check matching assets
        require(buyOrder.baseAsset == sellOrder.baseAsset && buyOrder.quoteAsset == sellOrder.quoteAsset, "assets do not match");

        // Check order amounts
        require(filledAmount <= buyOrder.amount, "incorrect amount for buy order");
        require(filledAmount <= sellOrder.amount, "incorrect amount for sell order");

        // Check Price values
        require(filledPrice <= buyOrder.price, "incorrect filled price for buy order");
        require(filledPrice >= sellOrder.price, "incorrect filled price for sell order");

        // Check Expiration Time. Convert to seconds first
        require(buyOrder.expiration.div(1000) >= now, "buy order expired");
        require(sellOrder.expiration.div(1000) >= now, "sell order expired");
    }

    /**
     *  @notice Orders values checks
     *  @dev helper function to validate orders
     */
    function updateBuyerBalance(Order memory buyOrder, uint filledAmount, uint amountQuote) internal{
        address buyer = buyOrder.senderAddress;
        uint baseBalance = assetBalances[buyer][buyOrder.baseAsset];
        uint quoteBalance = assetBalances[buyer][buyOrder.quoteAsset];
        uint matcherFee = buyOrder.matcherFee.mul(filledAmount).div(buyOrder.amount);

        //Will be updated in this function depending on the asset
        uint feeQuote = 0;
        uint feeBase = 0;

        // If matcher fee is paid in base Asset, check if buyer has balance in that asset
        if(buyOrder.matcherFeeAsset == buyOrder.baseAsset){
            require(baseBalance >= uint(buyOrder.matcherFee), "insufficient buyer's base asset balance");
            require(quoteBalance >= amountQuote, "insufficient buyer's quote asset balance");

            feeBase = matcherFee;
        }
        // If not, add amount and fee and check balance
        else{
            require(quoteBalance >= amountQuote.add(uint(buyOrder.matcherFee)), "insufficient buyer's quote asset balance");
            feeQuote = matcherFee;
        }

        // Transfer Matcher Fee
        safeTransfer(buyOrder.matcherAddress, buyOrder.matcherFeeAsset, matcherFee);

        // Update Buyer's Balance (- quoteAsset + baseAsset - matcherFeeAsset )
        assetBalances[buyer][buyOrder.quoteAsset] = quoteBalance.sub(amountQuote).sub(feeQuote);
        assetBalances[buyer][buyOrder.baseAsset] = baseBalance.add(filledAmount).sub(feeBase);

        assert(assetBalances[buyer][buyOrder.quoteAsset] < quoteBalance); // buyer's quote asset balance decreased
        assert(assetBalances[buyer][buyOrder.baseAsset] > baseBalance); // buyer's base asset balance increased
    }

    /**
     *  @notice Orders values checks
     *  @dev helper function to validate orders
     */
    function updateSellerBalance(Order memory sellOrder, uint filledAmount, uint amountQuote) internal{
        address seller = sellOrder.senderAddress;
        uint baseBalance = assetBalances[sellOrder.senderAddress][sellOrder.baseAsset];
        uint quoteBalance = assetBalances[sellOrder.senderAddress][sellOrder.quoteAsset];
        uint matcherFee = sellOrder.matcherFee.mul(filledAmount).div(sellOrder.amount);

         //Will be updated in this function depending on the asset
        uint feeQuote = 0;
        uint feeBase = 0;

        // If matcher fee is paid in quote Asset, check if seller has balance in that asset
        if(sellOrder.matcherFeeAsset == sellOrder.quoteAsset){
            require(quoteBalance >= uint(sellOrder.matcherFee), "insufficient seller's quote asset balance");
            require(baseBalance >= filledAmount, "insufficient seller's base asset balance");

            feeQuote = matcherFee;
        }
        // If not, add amount and fee and check balance
        else{
            require(baseBalance >= filledAmount.add(uint(sellOrder.matcherFee)), "insufficient seller's base asset balance");
            feeBase = matcherFee;
        }

        // Transfer Matcher Fee;
        safeTransfer(sellOrder.matcherAddress, sellOrder.matcherFeeAsset, matcherFee);


        // Update Seller's Balance  (+ quoteAsset - baseAsset - matcherFeeAsset  )
        assetBalances[seller][sellOrder.quoteAsset] = quoteBalance.add(amountQuote).sub(feeQuote);
        assetBalances[seller][sellOrder.baseAsset] = baseBalance.sub(filledAmount).sub(feeBase);

        assert(assetBalances[seller][sellOrder.quoteAsset] > quoteBalance); // seller's quote asset balance increased
        assert(assetBalances[seller][sellOrder.baseAsset] < baseBalance); // seller's base asset balance decreased
    }

    /**
     *  @notice Orders values checks
     *  @dev helper function to validate orders
     */
    function updateTrade(bytes32 orderHash, uint64 orderAmount, uint tradeAmount) internal {
        uint totalFilled;
        for(uint i = 0; i < trades[orderHash].length; i++){
            totalFilled = totalFilled.add(trades[orderHash][i].amount);
        }

        require(totalFilled.add(tradeAmount) <= orderAmount, "trade cannot be processed, exceeds order amount");

        uint newTotalFilled = totalFilled.add(tradeAmount);

        Status orderStatus = Status.NEW;

        if(newTotalFilled < orderAmount) orderStatus = Status.PARTIALLY_FILLED;
        if(newTotalFilled == orderAmount) orderStatus = Status.FILLED;

        Trade memory trade = Trade(orderHash, orderStatus, tradeAmount);

        trades[orderHash].push(trade);
    }


    /**
     * @notice users can cancel an order
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(Order memory order) public nonReentrant{
        bytes32 orderHash = getTypeValueHash(order);

        require(_msgSender() == order.senderAddress, "You are not the owner of this order");
        require(!cancelledOrders[orderHash], "order is already cancelled");

        cancelledOrders[orderHash] = true;

        emit OrderCancelled(orderHash, _msgSender());
    }

    /**
     *  @dev  revert on fallback function
     */
    function () external{
        revert("Please use depositWan function");
    }

    // OWNER FUNCTIONS

    /**
     * @dev change state of contracts
     */
    function updateContractState(bool newState) public onlyOwner{
        require(isActive != newState, "same as current state");
        isActive = newState;
    }
    
}