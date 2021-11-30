// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "./utils/Ownable.sol";
import "./ExchangeStorage.sol";

abstract contract OrionVault is ExchangeStorage, OwnableUpgradeSafe {

    enum StakePhase{ NOTSTAKED, LOCKED, RELEASING, READYTORELEASE, FROZEN }


    struct Stake {
        uint64 amount; // 100m ORN in circulation fits uint64
        StakePhase phase;
        uint64 lastActionTimestamp;
    }

    uint64 constant releasingDuration = 3600*24;
    mapping(address => Stake) private stakingData;


    /**
     * @dev Returns Stake with on-fly calculated StakePhase
     * @dev Note StakePhase may depend on time for some phases.
     * @param user address
     */
    function getStake(address user) public view returns (Stake memory stake){
        stake = stakingData[user];
        if(stake.phase == StakePhase.RELEASING && (block.timestamp - stake.lastActionTimestamp) > releasingDuration) {
            stake.phase = StakePhase.READYTORELEASE;
        }
    }

    /**
     * @dev Returns stake balance
     * @dev Note, this balance may be already unlocked
     * @param user address
     */
    function getStakeBalance(address user) public view returns (uint256) {
        return getStake(user).amount;
    }

    /**
     * @dev Returns stake phase
     * @param user address
     */
    function getStakePhase(address user) public view returns (StakePhase) {
        return getStake(user).phase;
    }

    /**
     * @dev Returns locked or frozen stake balance only
     * @param user address
     */
    function getLockedStakeBalance(address user) public view returns (uint256) {
        Stake memory stake = getStake(user);
        if(stake.phase == StakePhase.LOCKED || stake.phase == StakePhase.FROZEN)
            return stake.amount;
        return 0;
    }



    /**
     * @dev Change stake phase to frozen, blocking release
     * @param user address
     */
    function postponeStakeRelease(address user) external onlyOwner{
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.FROZEN;
    }

    /**
     * @dev Change stake phase to READYTORELEASE
     * @param user address
     */
    function allowStakeRelease(address user) external onlyOwner {
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.READYTORELEASE;
    }


    /**
     * @dev Request stake unlock for msg.sender
     * @dev If stake phase is LOCKED, that changes phase to RELEASING
     * @dev If stake phase is READYTORELEASE, that withdraws stake to balance
     * @dev Note, both unlock and withdraw is impossible if user has liabilities
     */
    function requestReleaseStake() public {
        address user = _msgSender();
        Stake memory current = getStake(user);
        require(liabilities[user].length == 0, "E1L");
        Stake storage stake = stakingData[_msgSender()];
        if(current.phase == StakePhase.READYTORELEASE) {
            assetBalances[user][address(_orionToken)] += stake.amount;
            stake.amount = 0;
            stake.phase = StakePhase.NOTSTAKED;
        } else if (current.phase == StakePhase.LOCKED) {
            stake.phase = StakePhase.RELEASING;
            stake.lastActionTimestamp = uint64(block.timestamp);
        } else {
            revert("E14");
        }
    }

    /**
     * @dev Lock some orions from exchange balance sheet
     * @param amount orions in 1e-8 units to stake
     */
    function lockStake(uint64 amount) public {
        address user = _msgSender();
        require(assetBalances[user][address(_orionToken)]>amount, "E1S");
        Stake storage stake = stakingData[user];

        assetBalances[user][address(_orionToken)] -= amount;
        stake.amount += amount;

        if(stake.phase != StakePhase.FROZEN) {
            stake.phase = StakePhase.LOCKED; //what is frozen should stay frozen
        }
        stake.lastActionTimestamp = uint64(block.timestamp);
    }

    /**
     * @dev send some orion from user's stake to receiver balance
     * @dev This function is used during liquidations, to reimburse liquidator
     *      with orions from stake for decreasing liabilities.
     * @dev Note, this function is used by MarginalFunctionality library, thus
     *      it can not be made private, but at the same time this function
     *      can only be called by contract itself. That way msg.sender check
     *      is critical.
     * @param user - user whose stake will be decreased
     * @param receiver - user which get orions
     * @param amount - amount of withdrawn tokens
     */
    function seizeFromStake(address user, address receiver, uint64 amount) public {
        require(msg.sender == address(this), "E14");
        Stake storage stake = stakingData[user];
        require(stake.amount >= amount, "UX"); //TODO
        stake.amount -= amount;
        assetBalances[receiver][address(_orionToken)] += amount;
    }

}

