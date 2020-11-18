pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
import "../PriceOracleInterface.sol";
import "../StakingInterface.sol";


library MarginalFunctionality {

    struct Liability {
        address asset;
        uint64 timestamp;
        uint192 outstandingAmount;
    }

    enum PositionState {
        POSITIVE,
        NEGATIVE, // weighted position below 0
        OVERDUE,  // liability is not returned for too long
        NOPRICE,  // some assets has no price or expired
        INCORRECT // some of the basic requirements are not met:
                  // too many liabilities, no locked stake, etc
    }
    struct Position {
        PositionState state;
        int256 weightedPosition;
        int256 totalPosition;
        int256 totalLiabilities;
    }

    function uint8Percent(int192 _a, uint8 b) internal pure returns (int192) {
        int a = int256(_a);
        int d = 255;
        int192 c = int192((a>65536) ? (a/d)*b : a*b/d );

        return c;
    }

    struct UsedConstants {
      address user;
      address _oracleAddress;
      address _stakingContractAddress;
      address _orionTokenAddress;
      uint64 positionOverdue;
      uint64 priceOverdue;
      uint8 stakeRisk;
      uint8 liquidationPremium;
    }

    function calcAssets(address[] storage collateralAssets,
                        mapping(address => mapping(address => int192)) storage assetBalances,
                        mapping(address => uint8) storage assetRisks,
                        UsedConstants memory constants)
             internal view returns
        (bool outdated, int192 weightedPosition, int192 totalPosition) {
        for(uint8 i = 0; i < collateralAssets.length; i++) {
          address asset = collateralAssets[i];
          if(assetBalances[constants.user][asset]<0)
              continue; // will be calculated in calcLiabilities
          (uint64 price, uint64 timestamp) = PriceOracleInterface(constants._oracleAddress).assetPrices(asset);//TODO givePrices
          // balance: i192, price u64 => balance*price fits i256
          // since generally balance <= N*maxInt112 (where N is number operations with it),
          // assetValue <= N*maxInt112*maxUInt64/1e8.
          // That is if N<= 2**17 *1e8 = 1.3e13  we can neglect overflows here
          int192 assetValue = int192(int256(assetBalances[constants.user][asset])*price/1e8);
          // Overflows logic holds here as well, except that N is the number of
          // operations for all assets
          weightedPosition += uint8Percent(assetValue, assetRisks[asset]);
          totalPosition += assetValue;
          outdated = outdated ||
                          ((timestamp + constants.priceOverdue) < now);
        }
        return (outdated, weightedPosition, totalPosition);
    }

    function calcLiabilities(mapping(address => Liability[]) storage liabilities,
                             mapping(address => mapping(address => int192)) storage assetBalances,
                             UsedConstants memory constants
                             )
             internal view returns
        (bool outdated, bool overdue, int192 weightedPosition, int192 totalPosition) {
        for(uint8 i = 0; i < liabilities[constants.user].length; i++) {
          Liability storage liability = liabilities[constants.user][i];
          (uint64 price, uint64 timestamp) = PriceOracleInterface(constants._oracleAddress).assetPrices(liability.asset);//TODO givePrices
          // balance: i192, price u64 => balance*price fits i256
          // since generally balance <= N*maxInt112 (where N is number operations with it),
          // assetValue <= N*maxInt112*maxUInt64/1e8.
          // That is if N<= 2**17 *1e8 = 1.3e13  we can neglect overflows here
          int192 liabilityValue = int192(
                                         int256(assetBalances[constants.user][liability.asset])
                                         *price/1e8
                                        );
          weightedPosition += liabilityValue; //already negative since balance is negative
          totalPosition += liabilityValue;
          overdue = overdue || ((liability.timestamp + constants.positionOverdue) < now);
          outdated = outdated ||
                          ((timestamp + constants.priceOverdue) < now);
        }

        return (outdated, overdue, weightedPosition, totalPosition);
    }

    function calcPosition(
                        address[] storage collateralAssets,
                        mapping(address => Liability[]) storage liabilities,
                        mapping(address => mapping(address => int192)) storage assetBalances,
                        mapping(address => uint8) storage assetRisks,
                        UsedConstants memory constants
                        )
             public view returns (Position memory) {
        (bool outdatedPrice, int192 weightedPosition, int192 totalPosition) =
          calcAssets(collateralAssets,
                     assetBalances,
                     assetRisks,
                     constants);
        (bool _outdatedPrice, bool overdue, int192 _weightedPosition, int192 _totalPosition) =
           calcLiabilities(liabilities,
                           assetBalances,
                           constants
                           );
        uint64 lockedAmount = StakingInterface(constants._stakingContractAddress)
                                  .getLockedStakeBalance(constants.user);
        int192 weightedStake = uint8Percent(int192(lockedAmount), constants.stakeRisk);
        weightedPosition += weightedStake;
        totalPosition += lockedAmount;

        weightedPosition += _weightedPosition;
        totalPosition += _totalPosition;
        outdatedPrice = outdatedPrice || _outdatedPrice;
        bool incorrect = (liabilities[constants.user].length > 3) ||
                         ((liabilities[constants.user].length>0) && (lockedAmount==0));
        Position memory result;
        if(_totalPosition<0) {
          result.totalLiabilities = _totalPosition;
        }
        if(weightedPosition<0) {
          result.state = PositionState.NEGATIVE;
        }
        if(outdatedPrice) {
          result.state = PositionState.NOPRICE;
        }
        if(overdue) {
          result.state = PositionState.OVERDUE;
        }
        if(incorrect) {
          result.state = PositionState.INCORRECT;
        }
        result.weightedPosition = weightedPosition;
        result.totalPosition = totalPosition;
        return result;
    }

    function removeLiability(address user,
                             address asset,
                             mapping(address => Liability[]) storage liabilities)
        public      {
        bool shift = false;
        uint8 i;
        for(; i<liabilities[user].length-1; i++) {
          if(liabilities[user][i].asset == asset) {
            shift = true;
          }
          if(shift)
            liabilities[user][i] = liabilities[user][i+1];
        }
        if(liabilities[user][i].asset == asset) {
            shift = true;
        }
        if(shift)
          liabilities[user].pop();
    }

    function updateLiability(address user,
                             address asset,
                             mapping(address => Liability[]) storage liabilities,
                             uint112 depositAmount,
                             int192 currentBalance)
        public      {
        uint8 i;
        for(; i<liabilities[user].length-1; i++) {
            if(liabilities[user][i].asset == asset)
              break;
          }
        Liability storage liability = liabilities[user][i];
        if(depositAmount>=liability.outstandingAmount) {
          if(currentBalance>=0) {
            removeLiability(user,asset,liabilities);
          }
          else {
            liability.outstandingAmount = uint192(-currentBalance);
            liability.timestamp = uint64(now);
          }
        } else {
            liability.outstandingAmount -= depositAmount;
        }
    }

    function partiallyLiquidate(address[] storage collateralAssets,
                                mapping(address => Liability[]) storage liabilities,
                                mapping(address => mapping(address => int192)) storage assetBalances,
                                mapping(address => uint8) storage assetRisks,
                                UsedConstants memory constants,
                                address redeemedAsset,
                                uint112 amount) public {
        //Note: constants.user - is broker who will be liquidated
        Position memory initialPosition = calcPosition(collateralAssets,
                                           liabilities,
                                           assetBalances,
                                           assetRisks,
                                           constants);
        require(initialPosition.state == PositionState.NEGATIVE ||
                initialPosition.state == PositionState.OVERDUE  , "E7");
        address liquidator = msg.sender;
        require(assetBalances[liquidator][redeemedAsset]>=amount,"E8");
        assetBalances[liquidator][redeemedAsset] -= amount;
        assetBalances[constants.user][redeemedAsset] += amount;
        (uint64 price, uint64 timestamp) = PriceOracleInterface(constants._oracleAddress).assetPrices(redeemedAsset);
        require((timestamp + constants.priceOverdue) > now, "E9"); //Price is outdated

        int64 orionAmount = reimburseLiquidator(amount, price, liquidator, assetBalances, constants);
        assetBalances[liquidator][constants._orionTokenAddress] += orionAmount;
        Position memory finalPosition = calcPosition(collateralAssets,
                                           liabilities,
                                           assetBalances,
                                           assetRisks,
                                           constants);
        require( int(finalPosition.state)<3 && //POSITIVE,NEGATIVE or OVERDUE
                 (finalPosition.weightedPosition>initialPosition.weightedPosition),
                 "E10");//Incorrect state position after liquidation
       if(finalPosition.state == PositionState.POSITIVE)
         require (finalPosition.weightedPosition<10e8,"Can not liquidate to very positive state");

    }

    function reimburseLiquidator(
                       uint112 amount,
                       uint64 price,
                       address liquidator,
                       mapping(address => mapping(address => int192)) storage assetBalances,
                       UsedConstants memory constants)
             internal
             returns (int64 orionAmount) {
        int192 _orionAmount = int192(int256(amount)*price/1e8);
        _orionAmount += uint8Percent(_orionAmount,constants.liquidationPremium); //Liquidation premium
        require(_orionAmount == int64(_orionAmount), "E11");
        orionAmount = int64(_orionAmount);
        // There is only 100m Orion tokens, fits i64
        int64 onBalanceOrion = int64(assetBalances[constants.user][constants._orionTokenAddress]);
        (int64 fromBalance, int64 fromStake) = (onBalanceOrion>orionAmount)?
                                                 (orionAmount, 0) :
                                                 (onBalanceOrion>0)?
                                                   (onBalanceOrion, orionAmount-onBalanceOrion) :
                                                   (0, orionAmount);

        if(fromBalance>0) {
          assetBalances[constants.user][constants._orionTokenAddress] -= int192(fromBalance);
        }
        if(fromStake>0) {
          StakingInterface(constants._stakingContractAddress).seizeFromStake(constants.user, liquidator, uint64(orionAmount));
        }
    }
}
