pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Utils.sol";
import "./libs/LibValidator.sol";
import "./libs/MarginalFunctionality.sol";

/**
 * @title Exchange
 * @dev Exchange contract for the Orion Protocol
 * @author @wafflemakr
 */
 
/*
  Overflow safety:
  We do not use SafeMath and control overflows by 
  not accepting large ints on input.

  Balances inside contract are stored as int192.

  Allowed input amounts are int112 or uint112: it is enough for all
  practically used tokens: for instance if decimal unit is 1e18, int112
  allow to encode up to 2.5e15 decimal units.
  That way adding/subtracting any amount from balances won't overflow, since 
  minimum number of operations to reach max int is practically infinite: ~1e24.
  
  Allowed prices are uint64. Note, that price is represented as
  price per 1e8 tokens. That means that amount*price always fit uint256,
  while amount*price/1e8 not only fit int192, but also can be added, subtracted
  without overflow checks: number of malicion operations to overflow ~1e13.
*/
contract Exchange is Utils, Ownable {

    using LibValidator for LibValidator.Order;

    // EVENTS
    event NewAssetDeposit(
        address indexed user,
        address indexed assetAddress,
        uint112 amount
    );
    event NewAssetWithdrawl(
        address indexed user,
        address indexed assetAddress,
        uint112 amount
    );
    event NewTrade(
        address indexed buyer,
        address indexed seller,
        address baseAsset,
        address quoteAsset,
        uint64 filledPrice,
        uint192 filledAmount,
        uint192 amountQuote
    );
    event OrderUpdate(
        bytes32 orderHash,
        address indexed user,
        Status orderStatus
    );

    // GLOBAL VARIABLES

    enum Status {NEW, PARTIALLY_FILLED, FILLED, PARTIALLY_CANCELLED, CANCELLED}

    struct Trade {
        uint64 filledPrice;
        uint192 filledAmount;
        uint192 feePaid;
        uint64 timestamp;
    }

    // Get trades by orderHash
    mapping(bytes32 => Trade[]) public trades;

    // Get trades by orderHash
    mapping(bytes32 => Status) public orderStatus;

    // Get user balance by address and asset address
    mapping(address => mapping(address => int192)) private assetBalances;
    // List of assets with negative balance for each user
    mapping(address => MarginalFunctionality.Liability[]) public liabilities;
    // List of assets which can be used as collateral and risk coefficients for them
    address[] private collateralAssets;
    mapping(address => uint8) public assetRisks;
    // Risk coefficient for locked ORN
    uint8 public stakeRisk;
    // Liquidation premium
    uint8 public liquidationPremium;
    // Delays after which price and position become outdated
    uint64 public priceOverdue;
    uint64 public positionOverdue;

    address _stakingContractAddress;
    IERC20 _orionToken;
    address _oracleAddress;

    // MAIN FUNCTIONS

    constructor(address stakingContractAddress, address orionToken, address priceOracleAddress) public {
      _stakingContractAddress = stakingContractAddress;
      _orionToken = IERC20(orionToken);
      _orionToken.approve(_stakingContractAddress, 2**256-1);
      _oracleAddress = priceOracleAddress;
      stakeRisk = 242; // 242.25/255 = 0.9;
      priceOverdue = 3 * 3600;
      positionOverdue = 24 * 3600;
      liquidationPremium = 12; // 12.75/255 = 0.05
    }

    function updateMarginalSettings(address[] memory _collateralAssets, 
                                    uint8 _stakeRisk,
                                    uint8 _liquidationPremium,
                                    uint64 _priceOverdue,
                                    uint64 _positionOverdue) public onlyOwner {
      collateralAssets = _collateralAssets;
      stakeRisk = _stakeRisk;
      liquidationPremium = _liquidationPremium;
      priceOverdue = _priceOverdue;
      positionOverdue = _positionOverdue;
    }
    
    function updateAssetRisks(address[] memory assets, uint8[] memory risks) public onlyOwner {
        for(uint16 i; i< assets.length; i++)
         assetRisks[assets[i]] = risks[i];
    }

    /**
     * @dev Deposit ERC20 tokens to the exchange contract
     * @dev User needs to approve token contract first
     * @param amount asset amount to deposit in its base unit
     */
    function depositAsset(address assetAddress, uint112 amount) external {
        IERC20 asset = IERC20(assetAddress);
        require(asset.transferFrom(_msgSender(), address(this), uint256(amount)), "E6");

        uint256 amountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );
        require(amountDecimal<uint112(-1), "E6");
        int112 safeAmountDecimal = int112(amountDecimal);
        assetBalances[_msgSender()][assetAddress] += safeAmountDecimal; 

        emit NewAssetDeposit(_msgSender(), assetAddress, uint112(safeAmountDecimal));
    }

    /**
     * @notice Deposit ETH to the exchange contract
     * @dev deposit event will be emitted with the amount in decimal format (10^8)
     * @dev balance will be stored in decimal format too
     */
    function deposit() external payable {
        int112 amountDecimal = int112(LibUnitConverter.baseUnitToDecimal(
            address(0),
            msg.value
        )); //cast to int112 is safe due to lack of ethereum in the wild

        assetBalances[_msgSender()][address(0)] += amountDecimal;
        if(msg.value>0)
          emit NewAssetDeposit(_msgSender(), address(0), uint112(amountDecimal));
    }

    /**
     * @dev Withdrawal of remaining funds from the contract back to the address
     * @param assetAddress address of the asset to withdraw
     * @param amount asset amount to withdraw in its base unit
     */
    function withdraw(address assetAddress, uint112 amount)
        external
        nonReentrant
    {
        uint256 amountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );
        
        require(amountDecimal<uint112(-1), "E6");
        int112 safeAmountDecimal = int112(amountDecimal);

        require(assetBalances[_msgSender()][assetAddress]>=safeAmountDecimal, "EX"); //TODO
        assetBalances[_msgSender()][assetAddress] -= safeAmountDecimal;

        safeTransfer(_msgSender(), assetAddress, uint256(safeAmountDecimal));

        emit NewAssetWithdrawl(_msgSender(), assetAddress, uint112(safeAmountDecimal));
    }


    function moveToStake(address user, uint64 amount) public {
      require(_msgSender() == _stakingContractAddress, "Unauthorized moveToStake");
      require(assetBalances[user][address(_orionToken)]>amount);
      assetBalances[user][address(_orionToken)] -= amount;
    }

    function moveFromStake(address user, uint64 amount) public {
      require(_msgSender() == _stakingContractAddress, "Unauthorized moveFromStake");
      assetBalances[user][address(_orionToken)] += amount;
    }

    /**
     * @dev Get asset balance for a specific address
     * @param assetAddress address of the asset to query
     * @param user user address to query
     */
    function getBalance(address assetAddress, address user)
        public
        view
        returns (int192 assetBalance)
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
        returns (int192[] memory)
    {
        int192[] memory balances = new int192[](assetsAddresses.length);
        for (uint16 i; i < assetsAddresses.length; i++) {
            balances[i] = assetBalances[user][assetsAddresses[i]];
        }
        return balances;
    }

    function getCollateralAssets() public view returns (address[] memory) {
        return collateralAssets;
    }

    /**
     * @dev get hash for an order
     */
    function getOrderHash(LibValidator.Order memory order) public pure returns (bytes32){
      return order.getTypeValueHash();
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
    function getFilledAmounts(bytes32 orderHash)
        public
        view
        returns (int192 totalFilled, int192 totalFeesPaid)
    {
        Trade[] storage orderTrades = trades[orderHash];

        for (uint16 i; i < orderTrades.length; i++) {
            // Note while filledAmount and feePaid are int192
            // they are guaranteed to be less that 2**156
            // it is safe to add them without checks
            totalFilled = totalFilled + int192(orderTrades[i].filledAmount);
            totalFeesPaid = totalFeesPaid + int192(orderTrades[i].feePaid);
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
        uint64 filledPrice,
        uint112 filledAmount
    ) public nonReentrant {
        // --- VARIABLES --- //

        // Amount of quote asset
        uint256 _amountQuote = uint256(filledAmount)*filledPrice/(10**8);
        require(_amountQuote<2**112-1, "Wrong amount");
        uint112 amountQuote = uint112(_amountQuote);

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
        require(!(isOrderCancelled(buyOrderHash) || isOrderCancelled(sellOrderHash)), "E4");

        // --- UPDATES --- //

        // Update User's balances
        updateOrderBalance(buyOrder, filledAmount, amountQuote, true);
        updateOrderBalance(sellOrder, filledAmount, amountQuote, false);
        require(checkPosition(buyOrder.senderAddress), "Incorrect margin position for buyer");
        require(checkPosition(sellOrder.senderAddress), "Incorrect margin position for seller");

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
        uint112 filledAmount,
        uint112 amountQuote,
        bool isBuyer
    ) internal {
        address user = order.senderAddress;
        // matcherFee: u64, filledAmount u128 => matcherFee*filledAmount fit u256
        // result matcherFee fit u64
        int192 matcherFee = int192(uint256(order.matcherFee)*filledAmount/order.amount); 


        bool feeAssetInLiabilities  = assetBalances[user][order.matcherFeeAsset]<0;
        (address firstAsset, address secondAsset) = isBuyer?
                                                     (order.quoteAsset, order.baseAsset):
                                                     (order.baseAsset, order.quoteAsset);
        int192 firstBalance = assetBalances[user][firstAsset];
        int192 secondBalance = assetBalances[user][secondAsset];
        bool firstInLiabilities = firstBalance<0;
        bool secondInLiabilities  = secondBalance<0;

        assetBalances[user][firstAsset] -= isBuyer? amountQuote : filledAmount;
        assetBalances[user][secondAsset] += isBuyer? filledAmount : amountQuote;
        if(!firstInLiabilities && (assetBalances[user][firstAsset]<0)){
          setLiability(user, firstAsset);
        }
        if(secondInLiabilities && (assetBalances[user][secondAsset]>=0)) {
          MarginalFunctionality.removeLiability(user, secondAsset, liabilities);
        }

        // User pay for fees
        assetBalances[user][order.matcherFeeAsset] -= matcherFee;
        if(!feeAssetInLiabilities && (assetBalances[user][order.matcherFeeAsset]<0)) {
            setLiability(user, order.matcherFeeAsset);
        }
        safeTransfer(order.matcherAddress, order.matcherFeeAsset, uint256(matcherFee));
    }

    /**
     *  @notice Store trade and update order
     */
    function updateTrade(
        bytes32 orderHash,
        LibValidator.Order memory order,
        uint112 filledAmount,
        uint64 filledPrice
    ) internal {
        // matcherFee: u64, filledAmount u128 => matcherFee*filledAmount fit u256
        // result matcherFee fit u64
        int192 matcherFee = int192(uint256(order.matcherFee)*filledAmount/order.amount);

        (int192 totalFilled, int192 totalFeesPaid) = getFilledAmounts(orderHash);

        uint256 afterFilled = uint256(totalFilled)+uint256(filledAmount);
        uint256 afterFee = uint256(totalFeesPaid)+uint256(matcherFee);
        
        require(afterFilled <= order.amount, "E3");
        require(afterFee <= order.matcherFee, "E3");

        Status status = Status.NEW;

        if (afterFilled == order.amount) {
            status = Status.FILLED;
        } else if (trades[orderHash].length > 0) {
            status = Status.PARTIALLY_FILLED;
        }

        //Update order status in storage
        orderStatus[orderHash] = status;

        // Store Trade
        trades[orderHash].push(
            Trade(filledPrice, uint192(filledAmount), uint192(matcherFee), uint64(now))
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
            int192 totalFilled, /*uint totalFeesPaid*/

        ) = getFilledAmounts(orderHash);

        if (totalFilled > 0)
            orderStatus[orderHash] = Status.PARTIALLY_CANCELLED;
        else orderStatus[orderHash] = Status.CANCELLED;

        emit OrderUpdate(orderHash, _msgSender(), orderStatus[orderHash]);

        assert(
            orderStatus[orderHash] == Status.PARTIALLY_CANCELLED ||
                orderStatus[orderHash] == Status.CANCELLED
        );
    }

    function checkPosition(address user) public view returns (bool) {
        if(liabilities[user].length == 0)
          return true;
        return calcPosition(user).state == MarginalFunctionality.PositionState.POSITIVE;
    }

    function getConstants(address user) 
             internal 
             view 
             returns (MarginalFunctionality.UsedConstants memory) {
       return MarginalFunctionality.UsedConstants(user, 
                                                  _oracleAddress, 
                                                  _stakingContractAddress,
                                                  address(_orionToken),
                                                  positionOverdue,
                                                  priceOverdue,
                                                  stakeRisk,
                                                  liquidationPremium);
    }

    function calcPosition(address user) public view returns (MarginalFunctionality.Position memory) {
        MarginalFunctionality.UsedConstants memory constants = 
          getConstants(user);
        return MarginalFunctionality.calcPosition(collateralAssets,
                                           liabilities,
                                           assetBalances,
                                           assetRisks,
                                           constants);

    }

    function partiallyLiquidate(address broker, address redeemedAsset, uint112 amount) public {
        MarginalFunctionality.UsedConstants memory constants = 
          getConstants(broker);
        MarginalFunctionality.partiallyLiquidate(collateralAssets,
                                           liabilities,
                                           assetBalances,
                                           assetRisks,
                                           constants,
                                           redeemedAsset,
                                           amount);        
    }
    
    function setLiability(address user, address asset) internal {
        MarginalFunctionality.Liability memory newLiability = MarginalFunctionality.Liability({asset: asset, timestamp: uint64(now)});
        liabilities[user].push(newLiability);
    }

    /**
     *  @dev  revert on fallback function
     */
    fallback() external {
        revert("E6");
    }

    /* Error Codes

        E1: Insufficient Balance,
        E2: Invalid Signature,
        E3: Invalid Order Info,
        E4: Order cancelled or expired,
        E5: Contract not active,
        E6: Transfer error
        E7: Incorrect state prior to liquidation
        E8: Liquidator doesn't satisfy requirements
        E9: Data for liquidation handling is outdated
        E10: Incorrect state after liquidation
    */
}
