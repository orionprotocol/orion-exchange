pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
import "../PriceOracleInterface.sol";
import "../StakingInterface.sol";


library MarginalFunctionality {

    struct Liability {
        address asset;
        uint64 timestamp;
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
    }

    /* SignedSafeMath */
    int256 constant private _INT256_MIN = -2**255;

    /**
     * @dev Returns the multiplication of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(int256 a, int256 b) internal pure returns (int256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        require(!(a == -1 && b == _INT256_MIN), "SignedSafeMath: multiplication overflow");

        int256 c = a * b;
        require(c / a == b, "SignedSafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two signed integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(int256 a, int256 b) internal pure returns (int256) {
        require(b != 0, "SignedSafeMath: division by zero");
        require(!(b == -1 && a == _INT256_MIN), "SignedSafeMath: division overflow");

        int256 c = a / b;

        return c;
    }

    /**
     * @dev Returns the subtraction of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(int256 a, int256 b) internal pure returns (int256) {
        int256 c = a - b;
        require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

        return c;
    }

    /**
     * @dev Returns the addition of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(int256 a, int256 b) internal pure returns (int256) {
        int256 c = a + b;
        require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

        return c;
    }


    function uint8Percent(int256 a, uint8 b) internal pure returns (int256) {
        int d = 255;
        int256 c = (a>65536) ? mul(div(a,d),b) : div(mul(a,b), d);

        return c;
    }

    /* Signed Math end */

    struct UsedConstants {
      address user;
      PriceOracleInterface _oracle;
      StakingInterface _stakingContract;
      uint64 positionOverdue;
      uint64 priceOverdue;
      uint8 stakeRisk;
    }

    function calcAssets(address[] storage collateralAssets,
                        mapping(address => mapping(address => uint256)) storage assetBalances,
                        mapping(address => uint8) storage assetRisks,
                        UsedConstants memory constants)
             internal view returns
        (bool outdated, int256 weightedPosition, int256 totalPosition) {
        for(uint8 i = 0; i < collateralAssets.length; i++) {
          address asset = collateralAssets[i];
          (uint64 price, uint64 timestamp) = constants._oracle.assetPrices(asset);//TODO givePrices
          int256 assetValue = mul(
                                int256(assetBalances[constants.user][asset]), //TODO
                                int256(price)
                               );
          weightedPosition =
            add (
              weightedPosition,
              uint8Percent(assetValue, assetRisks[asset])
            );
          totalPosition = add( totalPosition, assetValue);
          outdated = outdated ||
                          ((timestamp + constants.priceOverdue) < now);
        }
        return (outdated, weightedPosition, totalPosition);
    }

    function calcLiabilities(mapping(address => Liability[]) storage liabilities,
                             mapping(address => mapping(address => uint256)) storage assetBalances,
                             UsedConstants memory constants
                             )
             internal view returns
        (bool outdated, bool overdue, int256 weightedPosition, int256 totalPosition) {
        for(uint8 i = 0; i < liabilities[constants.user].length; i++) {
          Liability storage liability = liabilities[constants.user][i];
          (uint64 price, uint64 timestamp) = constants._oracle.assetPrices(liability.asset);//TODO givePrices
          int256 liabilityValue = mul(int256(assetBalances[constants.user][liability.asset]),int256(price)); //TODO unsafe cast
          weightedPosition = sub(weightedPosition, liabilityValue);
          totalPosition = sub(totalPosition, liabilityValue);
          overdue = overdue || ((liability.timestamp + constants.positionOverdue) < now);
          outdated = outdated ||
                          ((timestamp + constants.priceOverdue) < now);
        }

        return (outdated, overdue, weightedPosition, totalPosition);
    }

    function calcPosition(
                        address[] storage collateralAssets,
                        mapping(address => Liability[]) storage liabilities,
                        mapping(address => mapping(address => uint256)) storage assetBalances,
                        mapping(address => uint8) storage assetRisks,
                        UsedConstants memory constants
                        )
             public view returns (Position memory) {
        (bool outdatedPrice, int256 weightedPosition, int256 totalPosition) = 
          calcAssets(collateralAssets,
                     assetBalances,
                     assetRisks,
                     constants);
        (bool _outdatedPrice, bool overdue, int256 _weightedPosition, int256 _totalPosition) =
           calcLiabilities(liabilities,
                           assetBalances,
                           constants
                           );
        int256 lockedAmount = int256(constants._stakingContract.getLockedStakeBalance(constants.user));//TODO unsafe cast
        int256 weightedStake = uint8Percent(lockedAmount, constants.stakeRisk);
        weightedPosition = add(weightedPosition,weightedStake);
        totalPosition = add(totalPosition, lockedAmount); 

        weightedPosition = add(weightedPosition,_weightedPosition);
        totalPosition = add(totalPosition,_totalPosition);
        outdatedPrice = outdatedPrice || _outdatedPrice;
        bool incorrect = (liabilities[constants.user].length > 3) ||
                         ((liabilities[constants.user].length>0) && (lockedAmount==0));
        Position memory result;
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
        for(uint8 i=0; i<liabilities[user].length-1; i++) {
          if(liabilities[user][i].asset == asset) {
            shift = true;
          }
          if(shift)
            liabilities[user][i] = liabilities[user][i+1];
        }
        if(shift)
          liabilities[user].pop();
    }

}
