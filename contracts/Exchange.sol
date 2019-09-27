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

    using SafeMath for uint256;

    // EVENTS
    
    event NewWanDeposit(address indexed user, uint amount);

    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);

    event NewWanWithdrawl(address indexed user, uint amount);

    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);

    event NewTrade(uint tradeId, bytes32 buyOrderHash, bytes32 sellOrderHash, uint price, uint amount);

    event OrderCancelled(bytes32 indexed orderHash);


    // GLOBAL VARIABLES

    IERC20 public orion;

    struct Order{
        address senderAddress;
        address matcherAddress;
        address baseAsset;
        address quotetAsset;
        address matcherFeeAsset;
        uint256 amount;
        uint256 price;
        uint256 matcherFee;
        uint256 nonce;
        uint256 expirationTimestamp;
        bool side; // true = buy false = sell
    }

    struct Trade{
        bytes32 buyOrderHash;
        bytes32 sellOrderHash;
        uint8 orderStatus;
        uint256 filledAmount;
    }

    // Get trades by id
    mapping(uint => Trade) public trades;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint256)) public assetBalances;

    // Check if an order was cancelled
    mapping(bytes32 => bool) public cancelledOrders;

    uint public totalOrders;
    uint public totalTrades;

    // Pause or unpause exchange
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
        check conditions in orders for compliance filledPrice, filledAmount
        change balances on the contract respectively with buyer, seller, matcher
     * @param buyOrder structure of buy side order
     * @param sellOrder structure of sell side order
     * @param filledPrice price at which the order was settled
     * @param filledAmount amount settled between orders
     */
    function fillOrders(Order memory buyOrder, Order memory sellOrder, uint filledPrice, uint filledAmount) public onlyActive{

        require(filledPrice <= buyOrder.price, "incorrect filled price for buy order");
        require(filledPrice >= sellOrder.price, "incorrect filled price for sell order");

        require(filledAmount <= buyOrder.amount && filledAmount <= sellOrder.amount, "incorrect filled amount");

        //Amount of opposite asset according to filledPrice and filledAmount
        uint amountToTake = filledAmount.mul(filledPrice);
        require(amountToTake <= sellOrder.amount, "incorrect amount of quotet");

        require(buyOrder.baseAsset == sellOrder.quotetAsset, "incorrect asset match");

        address buyer = buyOrder.senderAddress;
        address seller = sellOrder.senderAddress;

        require(assetBalances[buyer][buyOrder.baseAsset] >= amountToTake, "insufficient maker's balance");       
        require(assetBalances[seller][sellOrder.baseAsset] >= filledAmount, "insufficient seller's balance");

        // Update Buyer's Balance
        assetBalances[buyer][buyOrder.baseAsset] = assetBalances[buyer][buyOrder.baseAsset].sub(amountToTake);
        assetBalances[buyer][buyOrder.quotetAsset] = assetBalances[buyer][buyOrder.quotetAsset].add(filledAmount);

        // Update Seller's Balance
        assetBalances[seller][sellOrder.baseAsset] = assetBalances[seller][sellOrder.baseAsset].sub(filledAmount);
        assetBalances[seller][sellOrder.quotetAsset] = assetBalances[seller][sellOrder.quotetAsset].add(amountToTake);
       

        bytes32 buyOrderHash = keccak256(abi.encodePacked(
            "order",
            buyOrder.senderAddress,
            buyOrder.matcherAddress,
            buyOrder.baseAsset,
            buyOrder.quotetAsset,
            buyOrder.amount,
            buyOrder.price
        ));

        require(!cancelledOrders[buyOrderHash], "buy order was cancelled");

        bytes32 sellOrderHash = keccak256(abi.encodePacked(
            "order",
            sellOrder.senderAddress,
            sellOrder.matcherAddress,
            sellOrder.baseAsset,
            sellOrder.quotetAsset,
            sellOrder.amount,
            sellOrder.price
        ));

        require(!cancelledOrders[sellOrderHash], "buy order was cancelled");

        totalTrades = totalTrades.add(1);

        //TODO what to put in orderStatus (compare filledAmount to which amount? buy or sell order)
        trades[totalTrades] = Trade(buyOrderHash, sellOrderHash, 0, filledAmount);

        emit NewTrade(totalTrades, buyOrderHash, sellOrderHash, filledPrice, filledAmount);

        //TODO Fees

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