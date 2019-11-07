pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './Utils.sol';


/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
contract Exchange is Ownable, Utils{

    using SafeMath for uint;
    using SafeMath for uint64;

    // EVENTS
    event NewAssetDeposit(address indexed user, address indexed assetAddress, uint amount);
    event NewAssetWithdrawl(address indexed user, address indexed assetAddress, uint amount);
    event NewTrade(address indexed buyer, address indexed seller, address baseAsset,
        address quoteAsset, uint filledPrice, uint filledAmount, uint amountToTake);
    event OrderCancelled(bytes32 indexed orderHash);


    // GLOBAL VARIABLES

    IERC20 public orion;

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade{
        bytes32 orderHash;
        Status orderStatus;
        uint filledAmount;
    }

    struct Signature{
        bytes32 r;
        bytes32 s;
        uint8 v ;
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
        public onlyActive
    {

        // VALIDATE SIGNATURES

        // Using web3 sign
        // require(isValidSignature(buyOrder, buySig), "Invalid signature for Buy order");
        // require(isValidSignature(sellOrder, sellSig), "Invalid signature for Sell order");

        // Using eth typed sign V1
        require(validateAddress(buyOrder), "Invalid signature for Buy order");
        require(validateAddress(sellOrder), "Invalid signature for Sell order");


        // VERIFICATIONS

        // Check matching assets
        require(buyOrder.matcherAddress == msg.sender && sellOrder.matcherAddress == msg.sender, "incorrect matcher address");
        require(buyOrder.baseAsset == sellOrder.baseAsset && buyOrder.quoteAsset == sellOrder.quoteAsset, "assets do not match");

        // Check Price
        require(filledPrice <= buyOrder.price, "incorrect filled price for buy order");
        require(filledPrice >= sellOrder.price, "incorrect filled price for sell order");

        // Check Expiration Time
        require(buyOrder.expiration.div(1000) >= now, "buy order expired");
        require(sellOrder.expiration.div(1000) >= now, "sell order expired");

        // Amount of quote asset
        uint amountToTake = filledAmount.mul(filledPrice).div(10**8);
        address buyer = buyOrder.senderAddress;
        address seller = sellOrder.senderAddress;

        // BUY SIDE CHECK
        require(assetBalances[buyer][buyOrder.quoteAsset] >= amountToTake, "insufficient buyer's balance");
        bytes32 buyOrderHash = getValueHash(buyOrder);
        require(!cancelledOrders[buyOrderHash], "buy order was cancelled");
        // require(_checkAmount(buyOrderHash, buyOrder.amount, filledAmount), "incorrect filled amount");

        // SELL SIDE CHECK
        require(assetBalances[seller][sellOrder.baseAsset] >= filledAmount, "insufficient seller's balance");
        bytes32 sellOrderHash = getValueHash(sellOrder);
        require(!cancelledOrders[sellOrderHash], "buy order was cancelled");
        // require(_checkAmount(sellOrderHash, sellOrder.amount, filledAmount), "incorrect filled amount");

        // === VERIFICATIONS DONE ===

        _updateBalances(buyer, seller, buyOrder.baseAsset, buyOrder.quoteAsset, filledAmount, amountToTake);

        totalTrades = totalTrades.add(1);

        // Store trades
        Trade memory buyTrade = Trade(buyOrderHash, Status.NEW, filledAmount); //temporary set 0 for orderStatus until logic implemented
        trades[buyOrderHash].push(buyTrade);
        Trade memory sellTrade = Trade(sellOrderHash, Status.NEW, filledAmount); //temporary set 0 for orderStatus until logic implemented
        trades[sellOrderHash].push(sellTrade);

        emit NewTrade(buyer, seller, buyOrder.baseAsset, buyOrder.quoteAsset, filledPrice, filledAmount, amountToTake);

    }

    function _updateBalances(
        address buyer, address seller, address baseAsset,
        address quoteAsset, uint filledAmount, uint amountToTake
    ) internal{

        // Update Buyer's Balance (- quoteAsset + baseAsset - matcherFeeAsset)
        assetBalances[buyer][quoteAsset] = assetBalances[buyer][quoteAsset].sub(amountToTake);
        assetBalances[buyer][baseAsset] = assetBalances[buyer][baseAsset].add(filledAmount);

        // Update Seller's Balance  (+ quoteAsset - baseAsset - matcherFeeAsset)
        assetBalances[seller][quoteAsset] = assetBalances[seller][quoteAsset].add(amountToTake);
        assetBalances[seller][baseAsset] = assetBalances[seller][baseAsset].sub(filledAmount);

    }

    function _checkAmount(bytes32 orderHash, uint orderAmount, uint newTradeAmount) internal view returns(bool){
        uint totalTradeAmount;
        for(uint i = 0; i < trades[orderHash].length; i++){
            totalTradeAmount = totalTradeAmount.add(trades[orderHash][i].filledAmount);
        }
        return (totalTradeAmount.add(newTradeAmount) <= orderAmount);
    }

    function _getOrderhash(Order memory _order) internal pure returns(bytes32){
        bytes32 buySide = keccak256(abi.encodePacked("buy"));

        return keccak256(abi.encodePacked(
            bytes1(0x03),
            _order.senderAddress,
            _order.matcherAddress,
            _order.baseAsset,
            _order.quoteAsset,
            _order.matcherFeeAsset,
            bytes8(_order.amount),
            bytes8(_order.price),
            bytes8(_order.matcherFee),
            bytes8(_order.nonce),
            bytes8(_order.expiration),
            keccak256(abi.encodePacked(_order.side)) == buySide ? bytes1(0x00):bytes1(0x01)
        ));
    }

    /**
     *  @dev Performs an `ecrecover` operation for signed message hashes
     */
    function _recoverAddress(bytes32 _hash, uint8 _v, bytes32 _r, bytes32 _s)
        internal
        pure
        returns (address)
    {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, _hash));
        return ecrecover(prefixedHash, _v, _r, _s);
    }

    function isValidSignature(Order memory order, Signature memory sig) public returns(bool) {
        bytes32 orderHash = _getOrderhash(order);
        address recovered = _recoverAddress(orderHash, sig.v, sig.r, sig.s);
        return recovered == order.senderAddress;
    }


    /**
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    function cancelOrder(Order memory order) public{
        //TODO: check if order can be cancelled

        bytes32 orderHash = _getOrderhash(order);

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