pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol'; 


/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol * 
 * @author @wafflemakr
 */
contract Exchange is Ownable{

    using SafeMath for uint256;

    // EVENTS
    
    event NewWanDeposit(address indexed user, uint amount);

    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);

    event NewWanWithdrawl(address indexed user, uint amount);

    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);

    event NewTrade(uint tradeId, bytes32 orderHash, uint price, uint amount);


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
        bytes32 orderHash;
        uint8 orderStatus;
        uint256 filledAmount;
    }

    // Get trades by id
    mapping(uint => Trade) public trades;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint256)) public assetBalances;

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
     * @dev 2 orders are submitted, it is necessary to match them:
        check conditions in orders for compliance filledPrice, filledAmount
        change balances on the contract respectively with buyer, seller, matcher
     */
    function fillOrders(Order memory buyOrder, Order memory sellOrder, uint filledPrice, uint filledAmount) public onlyActive{
        require(filledPrice == buyOrder.price, "incorrect filled price");
        require(filledAmount <= buyOrder.amount, "incorrect filled amount");

        uint amountToTake = filledAmount.mul(filledPrice);
        require(amountToTake <= sellOrder.amount, "incorrect taker's amount");

        require(buyOrder.baseAsset == sellOrder.quotetAsset, "incorrect asset match");

        address maker = buyOrder.senderAddress;
        address taker = sellOrder.senderAddress;

        require(assetBalances[maker][buyOrder.baseAsset] >= filledAmount, "not enough maker's balance");       
        require(assetBalances[taker][sellOrder.baseAsset] >= amountToTake, "not enough taker's balance");

        // MAKER
        assetBalances[maker][buyOrder.baseAsset] = assetBalances[maker][buyOrder.baseAsset].sub(amountToTake);
        assetBalances[maker][buyOrder.quotetAsset] = assetBalances[maker][buyOrder.quotetAsset].add(filledAmount);

        // TAKER
        assetBalances[taker][sellOrder.baseAsset] = assetBalances[taker][sellOrder.baseAsset].sub(filledAmount);
        assetBalances[taker][sellOrder.quotetAsset] = assetBalances[taker][sellOrder.quotetAsset].add(amountToTake);

        totalTrades = totalTrades.add(1);

        bytes32 orderHash = keccak256(abi.encodePacked(
            "newTrade",
            maker,
            taker,
            buyOrder.baseAsset,
            sellOrder.baseAsset,
            filledPrice,
            filledAmount
        ));

        Trade memory newTrade = Trade(orderHash, 0, filledAmount);
        trades[totalTrades] = newTrade;

        emit NewTrade(totalTrades, orderHash, filledPrice, filledAmount);

        //TODO Fees

    }

    /**
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(Order memory order) public{
        
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