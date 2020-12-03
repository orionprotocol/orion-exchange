pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./utils/ReentrancyGuard.sol";
import "./libs/LibUnitConverter.sol";
import "./libs/LibValidator.sol";
import "./libs/MarginalFunctionality.sol";
import "./OrionVault.sol";
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
contract Exchange is OrionVault, ReentrancyGuard {

    using LibValidator for LibValidator.Order;
    using SafeERC20 for IERC20;

    // EVENTS
    event NewAssetTransaction(
        address indexed user,
        address indexed assetAddress,
        bool isDeposit,
        uint112 amount,
        uint64 timestamp
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

    // MAIN FUNCTIONS

    function initialize() public payable initializer {
        OwnableUpgradeSafe.__Ownable_init();
    }

    function setBasicParams(address orionVaultContractAddress, address orionToken, address priceOracleAddress, address allowedMatcher) public onlyOwner {
      _orionToken = IERC20(orionToken);
      _oracleAddress = priceOracleAddress;
      _allowedMatcher = allowedMatcher;
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
        //require(asset.transferFrom(msg.sender, address(this), uint256(amount)), "E6");
        IERC20(assetAddress).safeTransferFrom(msg.sender, address(this), uint256(amount));
        generalDeposit(assetAddress,amount);
    }

    /**
     * @notice Deposit ETH to the exchange contract
     * @dev deposit event will be emitted with the amount in decimal format (10^8)
     * @dev balance will be stored in decimal format too
     */
    function deposit() external payable {
        generalDeposit(address(0), uint112(msg.value));
    }

    function generalDeposit(address assetAddress, uint112 amount) internal {
        address user = msg.sender;
        bool wasLiability = assetBalances[user][assetAddress]<0;
        int112 safeAmountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );
        assetBalances[user][assetAddress] += safeAmountDecimal;
        if(amount>0)
          emit NewAssetTransaction(user, assetAddress, true, uint112(safeAmountDecimal), uint64(block.timestamp));
        if(wasLiability)
          MarginalFunctionality.updateLiability(user, assetAddress, liabilities, uint112(safeAmountDecimal), assetBalances[user][assetAddress]);

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
        int112 safeAmountDecimal = LibUnitConverter.baseUnitToDecimal(
            assetAddress,
            amount
        );

        address user = msg.sender;

        require(assetBalances[user][assetAddress]>=safeAmountDecimal && checkPosition(user), "E1w"); //TODO
        assetBalances[user][assetAddress] -= safeAmountDecimal;
        
        uint256 _amount = uint256(amount);
        if(assetAddress == address(0)) {
          (bool success, ) = user.call{value:_amount}("");
          require(success, "E6w");
        } else {
          IERC20(assetAddress).safeTransfer(user, _amount);
        }


        emit NewAssetTransaction(user, assetAddress, false, uint112(safeAmountDecimal), uint64(block.timestamp));
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

    function getLiabilities(address user)
        public
        view
        returns (MarginalFunctionality.Liability[] memory liabilitiesArray)
    {
        return liabilities[user];
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
    function getFilledAmounts(bytes32 orderHash, LibValidator.Order memory order)
        public
        view
        returns (int192 totalFilled, int192 totalFeesPaid)
    {
        totalFilled = int192(filledAmounts[orderHash]); //It is safe to convert here: filledAmounts is result of ui112 additions
        totalFeesPaid = int192(uint256(order.matcherFee)*uint112(totalFilled)/order.amount); //matcherFee is u64; safe multiplication here
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
        require(_amountQuote<2**112-1, "E12G");
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
                msg.sender,
                filledAmount,
                filledPrice,
                block.timestamp,
                _allowedMatcher
            ),
            "E3G"
        );


        // --- UPDATES --- //

        //updateFilledAmount
        filledAmounts[buyOrderHash] += filledAmount; //it is safe to add ui112 to each other to get i192
        filledAmounts[sellOrderHash] += filledAmount;
        require(filledAmounts[buyOrderHash] <= buyOrder.amount, "E12B");
        require(filledAmounts[sellOrderHash] <= sellOrder.amount, "E12S");


        // Update User's balances
        updateOrderBalance(buyOrder, filledAmount, amountQuote, true);
        updateOrderBalance(sellOrder, filledAmount, amountQuote, false);
        require(checkPosition(buyOrder.senderAddress), "Incorrect margin position for buyer");
        require(checkPosition(sellOrder.senderAddress), "Incorrect margin position for seller");


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
        order.matcherFee = uint64(uint256(order.matcherFee)*filledAmount/order.amount); //rewrite in memory only
        if(!isBuyer)
          (filledAmount, amountQuote) = (amountQuote, filledAmount);

        bool feeAssetInLiabilities  = assetBalances[user][order.matcherFeeAsset]<0;
        (address firstAsset, address secondAsset) = isBuyer?
                                                     (order.quoteAsset, order.baseAsset):
                                                     (order.baseAsset, order.quoteAsset);
        int192 firstBalance = assetBalances[user][firstAsset];
        int192 secondBalance = assetBalances[user][secondAsset];
        int192 temp; // this variable will be used for temporary variable storage (optimization purpose)
        bool firstInLiabilities = firstBalance<0;
        bool secondInLiabilities  = secondBalance<0;

        temp = assetBalances[user][firstAsset] - amountQuote;
        assetBalances[user][firstAsset] = temp;
        assetBalances[user][secondAsset] += filledAmount;
        if(!firstInLiabilities && (temp<0)){
          setLiability(user, firstAsset, temp);
        }
        if(secondInLiabilities && (assetBalances[user][secondAsset]>=0)) {
          MarginalFunctionality.removeLiability(user, secondAsset, liabilities);
        }

        // User pay for fees
        temp = assetBalances[user][order.matcherFeeAsset] - order.matcherFee;
        assetBalances[user][order.matcherFeeAsset] = temp;
        if(!feeAssetInLiabilities && (temp<0)) {
            setLiability(user, order.matcherFeeAsset, temp);
        }
        assetBalances[order.matcherAddress][order.matcherFeeAsset] += order.matcherFee;
        //generalTransfer(order.matcherFeeAsset, order.matcherAddress, order.matcherFee, true);
        //IERC20(order.matcherFeeAsset).safeTransfer(order.matcherAddress, uint256(order.matcherFee)); //TODO not transfer, but add to balance
    }

    /**
     * @notice users can cancel an order
     * @dev write an orderHash in the contract so that such an order cannot be filled (executed)
     */
    /* Unused for now
    function cancelOrder(LibValidator.Order memory order) public {
        require(order.validateV3(), "E2");
        require(msg.sender == order.senderAddress, "Not owner");

        bytes32 orderHash = order.getTypeValueHash();

        require(!isOrderCancelled(orderHash), "E4");

        (
            int192 totalFilled, //uint totalFeesPaid

        ) = getFilledAmounts(orderHash);

        if (totalFilled > 0)
            orderStatus[orderHash] = Status.PARTIALLY_CANCELLED;
        else orderStatus[orderHash] = Status.CANCELLED;

        emit OrderUpdate(orderHash, msg.sender, orderStatus[orderHash]);

        assert(
            orderStatus[orderHash] == Status.PARTIALLY_CANCELLED ||
                orderStatus[orderHash] == Status.CANCELLED
        );
    }
    */

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
                                                  address(this),
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

    function setLiability(address user, address asset, int192 balance) internal {
        liabilities[user].push(
          MarginalFunctionality.Liability({
                                             asset: asset,
                                             timestamp: uint64(block.timestamp),
                                             outstandingAmount: uint192(-balance)})
        );
    }

    /**
     *  @dev  revert on fallback function
     */
    fallback() external {
        revert("E6");
    }

    /* Error Codes

        E1: Insufficient Balance, flavor S - stake
        E2: Invalid Signature, flavor B,S - buyer, seller
        E3: Invalid Order Info, flavor G - general, M - wrong matcher, M2 unauthorized matcher, As - asset mismatch, AmB/AmS - amount mismatch (buyer,seller), PrB/PrS - price mismatch(buyer,seller), D - direction mismatch,
        E4: Order expired, flavor B,S - buyer,seller
        E5: Contract not active,
        E6: Transfer error
        E7: Incorrect state prior to liquidation
        E8: Liquidator doesn't satisfy requirements
        E9: Data for liquidation handling is outdated
        E10: Incorrect state after liquidation
        E11: Amount overflow
        E12: Incorrect filled amount, flavor G,B,S: general(overflow), buyer order overflow, seller order overflow
        E14: Authorization error, sfs - seizeFromStake
    */

}
