pragma solidity ^0.5.10;

import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/IERC20.sol'; 


/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol * 
 * @author @wafflemakr
 */
contract Exchange is Ownable{

    using SafeMath for uint256;
    using SafeMath for uint64;

    // EVENTS
    
    event NewEthDeposit(address indexed user, uint amount);

    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);

    event NewEthWithdrawl(address indexed user, uint amount);

    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);


    // GLOBAL VARIABLES

    IERC20 public orion;

    struct Order{
        address senderAddress;
        address matcherAddress;
        address baseAsset;
        address quotetAsset;
        address matcherFeeAsset;        
        uint64 amount;
        uint64 price;
        uint64 matcherFee;
        uint64 nonce;
        uint64 expirationTimestamp;
        bool side; // true = buy false = sell , or string preferred?

    }

    struct Trade{
        bytes32 orderHash;
        uint8 orderStatus;
        uint64 filledAmount;
    }

    // Get orders by id
    mapping(uint => Order) public orders;

    // Get trades by id
    mapping(uint => Trade) public trades;

    // Get user balance by address and asset address
    mapping(address => mapping(address => uint256)) public assetBalances;

    // Get user eth balance by address 
    mapping(address => uint256) public ethBalances;

    uint totalOrders;
    uint totalTrades;

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
     * @dev Deposit ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     */
    function depositAsset(address assetAddress, uint amount) public payable onlyActive{
        IERC20 asset = IERC20(assetAddress);
    
        require(asset.transferFrom(msg.sender, address(this), amount), "error transfering asset to exchange");
        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].add(amount);

        emit NewAssetDeposit(msg.sender, assetAddress, msg.value);
    }

    /**
     * @dev Deposit ETH to the exchange contract
     */
    function depositEth() public payable onlyActive{
        require(msg.value > 0, "deposited value has to be greater than zeo");
        ethBalances[msg.sender] = ethBalances[msg.sender].add(msg.value);

        emit NewEthDeposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     */
    function withdrawAsset(address assetAddress, uint amount) public{
        require(assetBalances[msg.sender][assetAddress] >= amount, "not enough funds to withdraw");
        IERC20 asset = IERC20(assetAddress);

        require(asset.transfer(msg.sender, amount), "error transfering funds to user");
        assetBalances[msg.sender][assetAddress] = assetBalances[msg.sender][assetAddress].sub(amount);

        emit NewAssetWithdrawl(msg.sender, assetAddress, amount);
    }
    
    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     */
    function withdrawEth(uint amount) public{
        require(ethBalances[msg.sender] >= amount, "not enough funds to withdraw");
        msg.sender.transfer(amount);
        ethBalances[msg.sender] = ethBalances[msg.sender].sub(amount);

        emit NewEthWithdrawl(msg.sender, amount);
    } 


    /**
     * @dev Receiving balance at a specific address
     */
    function getAssetBalance(address assetAddress, address user) public view returns(uint assetBalance){
        return assetBalances[user][assetAddress];
    }

    /**
     * @dev Receiving balance at a specific address
     */
    function getEthBalance(address user) public view returns(uint ethBalance){
        return ethBalances[user];
    }

    /**
     * @dev 2 orders are submitted, it is necessary to match them:
        check conditions in orders for compliance filledPrice, filledAmount
        change balances on the contract respectively with buyer, seller, matcher
     */
    function fillOrders(uint buyOrder, uint sellOrder, uint64 filledPrice, uint64 filledAmount) public{
        
    }

    /**
     * @dev write an orderHash in the contract so that such an order cannot be filed (executed)
     */
    function cancelOrder() public{
        
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