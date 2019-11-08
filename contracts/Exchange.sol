pragma solidity ^0.5.10;
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

    using SafeMath for uint;
    using SafeMath for uint64;

    // EVENTS
    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);
    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);
    event NewTrade(address indexed buyer, address indexed seller, address baseAsset,
        address quoteAsset, uint filledPrice, uint filledAmount, uint amountToTake);
    event OrderCancelled(bytes32 indexed orderHash);


    // GLOBAL VARIABLES

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade{
        bytes32 orderHash;
        Status orderStatus;
        uint filledAmount;
    }

    // Get trades by orderHash
    mapping(bytes32 => Trade[]) public trades;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint)) public assetBalances;

    // Check if an order was cancelled
    mapping(bytes32 => bool) public cancelledOrders;

    uint public totalOrders;
    uint public totalTrades;

    // Pause or unpause exchangebuyOrderHash
    bool isActive = true;


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
     * @dev Deposit WAN or ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     * @param amount asset amount to deposit in its base unit
     */
    function depositAsset(address assetAddress, uint amount) public payable onlyActive{
        IERC20 asset = IERC20(assetAddress);
        require(asset.transferFrom(msg.sender, address(this), amount), "error transfering asset to exchange");

        uint amountDecimal = baseUnitToDecimal(assetAddress, amount);

        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].add(amountDecimal);

        emit NewAssetDeposit(msg.sender, assetAddress, amountDecimal);
    }

    /**
     * @dev Deposit WAN to the exchange contract
     */
    function depositWan() public payable onlyActive{
        require(msg.value > 0, "invalid amount sent");

        uint amountDecimal = baseUnitToDecimal(address(0), msg.value);

        assetBalances[msg.sender][address(0)] = assetBalances[msg.sender][address(0)].add(amountDecimal);

        emit NewAssetDeposit(msg.sender, address(0), amountDecimal);
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     * @param amount asset amount to withdraw in its base unit
     */
    function withdraw(address assetAddress, uint amount) public{
        uint amountDecimal = baseUnitToDecimal(assetAddress, amount);

        require(assetBalances[msg.sender][assetAddress] >= amountDecimal, "not enough funds to withdraw");

        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].sub(amountDecimal);

        if(assetAddress == address(0))
            msg.sender.transfer(amount);
        else{
            IERC20 asset = IERC20(assetAddress);
            require(asset.transfer(msg.sender, amount), "error transfering funds to user");
        }

        emit NewAssetWithdrawl(msg.sender, assetAddress, amountDecimal);
    }


    /**
     * @dev Asset balance for a specific address
     */
    function getBalance(address assetAddress, address user) public view returns(uint assetBalance){
        return assetBalances[user][assetAddress];
    }

    /**
     * @dev Batch request of asset balances
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
    {

        // VARIABLES
        // Amount of quote asset
        uint amountQuote = filledAmount.mul(filledPrice).div(10**8);

        // Parties
        address buyer = buyOrder.senderAddress;
        address seller = sellOrder.senderAddress;

        // Order Hashes
        bytes32 buyOrderHash = getTypeValueHash(buyOrder);
        bytes32 sellOrderHash = getTypeValueHash(sellOrder);

        _validateOrders(buyOrder, sellOrder, filledPrice, filledAmount, amountQuote);


        // BUY SIDE CHECK
        require(assetBalances[buyer][buyOrder.quoteAsset] >= amountQuote, "insufficient buyer's balance");
        require(!cancelledOrders[buyOrderHash], "buy order was cancelled");
        // require(_checkAmount(buyOrderHash, buyOrder.amount, filledAmount), "incorrect filled amount");

        // SELL SIDE CHECK
        require(assetBalances[seller][sellOrder.baseAsset] >= filledAmount, "insufficient seller's balance");
        require(!cancelledOrders[sellOrderHash], "buy order was cancelled");
        // require(_checkAmount(sellOrderHash, sellOrder.amount, filledAmount), "incorrect filled amount");

        // === VERIFICATIONS DONE ===

        _updateBalances(buyer, seller, buyOrder.baseAsset, buyOrder.quoteAsset, filledAmount, amountQuote);

        totalTrades = totalTrades.add(1);

        // Store trades
        Trade memory buyTrade = Trade(buyOrderHash, Status.NEW, filledAmount); //temporary set 0 for orderStatus until logic implemented
        trades[buyOrderHash].push(buyTrade);
        Trade memory sellTrade = Trade(sellOrderHash, Status.NEW, amountQuote); //temporary set 0 for orderStatus until logic implemented
        trades[sellOrderHash].push(sellTrade);

        emit NewTrade(buyer, seller, buyOrder.baseAsset, buyOrder.quoteAsset, filledPrice, filledAmount, amountQuote);

    }

    /**
        @notice Orders values checks
        @dev helper function to validate orders
     */
    function _validateOrders(
        Order memory buyOrder, Order memory sellOrder,
        uint filledPrice, uint filledAmount, uint amountQuote
    ) internal {

        // Validate signatures using eth typed sign V1
        require(validateV1(buyOrder), "Invalid signature for Buy order");
        require(validateV1(sellOrder), "Invalid signature for Sell order");

        // Same matcher address
        require(buyOrder.matcherAddress == msg.sender && sellOrder.matcherAddress == msg.sender, "incorrect matcher address");

        // Check matching assets
        require(buyOrder.baseAsset == sellOrder.baseAsset && buyOrder.quoteAsset == sellOrder.quoteAsset, "assets do not match");

        // Check order amounts
        require(filledAmount <= buyOrder.amount, "incorrect amount for buy order");
        require(amountQuote <= sellOrder.amount, "incorrect amount for sell order");

        // Check Price values
        require(filledPrice <= buyOrder.price, "incorrect filled price for buy order");
        require(filledPrice >= sellOrder.price, "incorrect filled price for sell order");

        // Check Expiration Time. Convert to seconds first
        require(buyOrder.expiration.div(1000) >= now, "buy order expired");
        require(sellOrder.expiration.div(1000) >= now, "sell order expired");
    }

    /**
        @notice update buyer and seller balances
     */
    function _updateBalances(
        address buyer, address seller, address baseAsset,
        address quoteAsset, uint filledAmount, uint amountQuote
    ) internal{

        // Update Buyer's Balance (- quoteAsset + baseAsset - matcherFeeAsset)
        assetBalances[buyer][quoteAsset] = assetBalances[buyer][quoteAsset].sub(amountQuote);
        assetBalances[buyer][baseAsset] = assetBalances[buyer][baseAsset].add(filledAmount);

        // Update Seller's Balance  (+ quoteAsset - baseAsset - matcherFeeAsset)
        assetBalances[seller][quoteAsset] = assetBalances[seller][quoteAsset].add(amountQuote);
        assetBalances[seller][baseAsset] = assetBalances[seller][baseAsset].sub(filledAmount);

    }

    /**
        @notice check if the order has been filled completely
     */
    function _checkAmount(bytes32 orderHash, uint orderAmount, uint newTradeAmount) internal view returns(bool){
        uint totalTradeAmount;
        for(uint i = 0; i < trades[orderHash].length; i++){
            totalTradeAmount = totalTradeAmount.add(trades[orderHash][i].filledAmount);
        }
        return (totalTradeAmount.add(newTradeAmount) <= orderAmount);
    }
    



    /**
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(Order memory order) public{
        //TODO: check if order can be cancelled

        bytes32 orderHash = getTypeValueHash(order);

        cancelledOrders[orderHash] = true;
        emit OrderCancelled(orderHash);
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