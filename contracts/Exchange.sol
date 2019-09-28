pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
contract Exchange is Ownable{

    using SafeMath for uint;

    // EVENTS
    event NewWanDeposit(address indexed user, uint amount);
    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);
    event NewWanWithdrawl(address indexed user, uint amount);
    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);
    event NewTrade(bytes32 buyOrderHash, bytes32 sellOrderHash, uint pricebuyOrderHash, uint amount);
    event OrderCancelled(bytes32 indexed orderHash);


    // GLOBAL VARIABLES

    IERC20 public orion;

    struct Order{
        address senderAddress;
        address matcherAddress;
        address baseAsset;
        address quotetAsset;
        address matcherFeeAsset;
        uint amount;
        uint price;
        uint matcherFee;
        uint nonce;
        uint expiration;
        bool side; // true = buy false = sell
    }

    struct Trade{
        bytes32 orderHash;
        uint8 orderStatus;
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


    // MAIN FUNCTIONSh
    /**
     * @dev Deposit WAN or ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     */
    function depositAsset(address assetAddress, uint amount) public payable onlyActive{
        IERC20 asset = IERC20(assetAddress);
        require(asset.transferFrom(msg.sender, address(this), amount), "error transfering asset to exchange");

        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].add(amount);

        emit NewAssetDeposit(msg.sender, assetAddress, amount);
    }

    /**
     * @dev Deposit WAN to the exchange contract
     */
    function depositWan() public payable onlyActive{
        require(msg.value > 0, "invalid amount sent");

        assetBalances[msg.sender][address(0)] = assetBalances[msg.sender][address(0)].add(msg.value);

        emit NewAssetDeposit(msg.sender, address(0), msg.value);
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     */
    function withdraw(address assetAddress, uint amount) public{
        require(assetBalances[msg.sender][assetAddress] >= amount, "not enough funds to withdraw");
        IERC20 asset = IERC20(assetAddress);

        require(asset.transfer(msg.sender, amount), "error transfering funds to user");
        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].sub(amount);

        emit NewAssetWithdrawl(msg.sender, assetAddress, amount);
    }


    /**
     * @dev Asset balance for a specific address
     */
    function getBalance(address assetAddress, address user) public view returns(uint assetBalance){
        return assetBalances[user][assetAddress];
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
    function fillOrders(Order memory buyOrder, Order memory sellOrder, uint filledPrice, uint filledAmount) public onlyActive{

        //VERIFICATIONS

        require(buyOrder.matcherAddress == msg.sender && sellOrder.matcherAddress == msg.sender, "incorrect matcher address");
        require(buyOrder.baseAsset == sellOrder.baseAsset && buyOrder.quotetAsset == sellOrder.quotetAsset, "assets do not match");
        require(filledPrice <= buyOrder.price, "incorrect filled price for buy order");
        require(filledPrice >= sellOrder.price, "incorrect filled price for sell order");
        require(buyOrder.expiration <= now && sellOrder.expiration <= now, "order expiration");

        //Amount of opposite asset according to filledPrice and filledAmount
        uint amountToTake = filledAmount.mul(filledPrice);
        require(amountToTake <= sellOrder.amount, "incorrect amount to take");

        address buyer = buyOrder.senderAddress;
        address seller = sellOrder.senderAddress;

        // BUY SIDE CHECK

        require(assetBalances[buyer][buyOrder.quotetAsset] >= amountToTake, "insufficient buyer's balance");
        bytes32 buyOrderHash = _getOrderhash(buyOrder);
        require(!cancelledOrders[buyOrderHash], "buy order was cancelled");
        require(_checkAmount(buyOrderHash, buyOrder.amount, filledAmount), "incorrect filled amount");

        // SELL SIDE CHECK
        require(assetBalances[seller][sellOrder.baseAsset] >= filledAmount, "insufficient seller's balance");
        bytes32 sellOrderHash = _getOrderhash(sellOrder);
        require(!cancelledOrders[sellOrderHash], "buy order was cancelled");
        require(_checkAmount(sellOrderHash, sellOrder.amount, filledAmount), "incorrect filled amount");

        // === VERIFICATIONS DONE ===

        // Update Buyer's Balance (- quoteAsset + baseAsset - matcherFeeAsset)
        assetBalances[buyer][buyOrder.quotetAsset] = assetBalances[buyer][buyOrder.quotetAsset].sub(amountToTake);
        assetBalances[buyer][buyOrder.baseAsset] = assetBalances[buyer][buyOrder.baseAsset].add(filledAmount);

        // Update Seller's Balance  (+ quoteAsset - baseAsset - matcherFeeAsset)
        assetBalances[seller][sellOrder.baseAsset] = assetBalances[seller][sellOrder.baseAsset].sub(filledAmount);
        assetBalances[seller][sellOrder.quotetAsset] = assetBalances[seller][sellOrder.quotetAsset].add(amountToTake);

        totalTrades = totalTrades.add(1);

        //Store trades
        Trade memory buyTrade = Trade(buyOrderHash, 0, filledAmount); //temporary set 0 for orderStatus until logic implemented
        trades[buyOrderHash].push(buyTrade);
        Trade memory sellTrade = Trade(sellOrderHash, 0, filledAmount); //temporary set 0 for orderStatus until logic implemented
        trades[sellOrderHash].push(sellTrade);


        //TODO what to put in orderStatus (compare filledAmount to which amount? buy or sell order)

        emit NewTrade(buyOrderHash, sellOrderHash, filledPrice, filledAmount);

    }

    function _checkAmount(bytes32 orderHash, uint orderAmount, uint newTradeAmount) internal view returns(bool){
        uint totalTradeAmount;
        for(uint i = 0; i < trades[orderHash].length; i++){
            totalTradeAmount = totalTradeAmount.add(trades[orderHash][i].filledAmount);
        }
        return (totalTradeAmount.add(newTradeAmount) <= orderAmount);
    }

    function _getOrderhash(Order memory _order) internal pure returns(bytes32){
        return keccak256(abi.encodePacked(
            "order",
            _order.senderAddress,
            _order.matcherAddress,
            _order.baseAsset,
            _order.quotetAsset,
            _order.amount,
            _order.price,
            _order.nonce
        ));
    }

    /**
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(Order memory order) public{
        //TODO: check if order can be cancelled

        bytes32 orderHash = keccak256(abi.encodePacked(
            "order",
            order.senderAddress,
            order.matcherAddress,
            order.baseAsset,
            order.quotetAsset,
            order.amount,
            order.price
        ));

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