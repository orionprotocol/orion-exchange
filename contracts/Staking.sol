pragma solidity 0.5.10;
import "@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title Staking
 * @dev Staking contract for the Orion Protocol
 * @author @EmelyanenkoK
 */
contract Staking is Ownable {

    enum StakePhase{ NOTSTAKED, LOCKING, LOCKED, RELEASING, READYTORELEASE, FROZEN }

    struct Stake {
      uint256 amount;
      StakePhase phase;
      uint64 lastActionTimestamp;
    }

    uint64 constant lockingDuration = 3600*24;
    uint64 constant releasingDuration = 3600*24;

    //Asset for staking
    address baseAssetAddress;

    // Get user balance by address and asset address
    mapping(address => Stake) private stakingData;
    mapping(address => mapping(address => uint256)) virtual assetBalances;


    constructor(address orionTokenAddress) internal {
        baseAssetAddress = orionTokenAddress;
    }

    function moveFromBalance(uint256 amount) internal {
        assetBalances[_msgSender()][baseAssetAddress] = assetBalances[_msgSender()][baseAssetAddress]
            .sub(amount);
        Stake storage stake = stakingData[_msgSender()];
        stake.amount = stake.amount.add(amount);            
    }

    function moveToBalance() internal {
        Stake storage stake = stakingData[_msgSender()];
        assetBalances[_msgSender()][baseAssetAddress] = assetBalances[_msgSender()][baseAssetAddress]
            .add(stake.amount);
        stake.amount = 0;     
    }

    function lockStake(uint256 amount) external {
        assert(getStakePhase(_msgSender()) == StakePhase.NOTSTAKED); // TODO do we need this?
        moveFromBalance(amount);
        Stake storage stake = stakingData[_msgSender()];
        stake.phase = StakePhase.LOCKING;
        stake.lastActionTimestamp = now;
    }

    function requestReleaseStake() external {
        StakePhase currentPhase = getStakePhase(_msgSender());
        if(currentPhase == StakePhase.LOCKING || currentPhase == StakePhase.READYTORELEASE) {
          moveToBalance();
          Stake storage stake = stakingData[_msgSender()];
          stake.phase = StakePhase.NOTSTAKED;
        } else if (currentPhase == StakePhase.LOCKED) {
          Stake storage stake = stakingData[_msgSender()];
          stake.phase = StakePhase.RELEASING;
          stake.lastActionTimestamp = now;
        } else {
          revert("Can not release funds from this phase");
        }

    }

    function postponeStakeRelease(address user) external onlyOwner{
        Stake storage stake = stakingData[_msgSender()];
        stake.phase = StakePhase.FROZEN;        
    }

    function allowStakeRelease(address user) external onlyOwner {
        Stake storage stake = stakingData[_msgSender()];
        stake.phase = StakePhase.READYTORELEASE;        
    }

    function seize(address user, address receiver) external {
    }

    function getStake(address user) public view {
        Stake memory stake = stakingData[user];
        if(stake.phase == StakePhase.LOCKING && (now - stake.lastActionTimestamp) > lockingDuration) {
          stake.phase = StakePhase.LOCKED;
        } else if(stake.phase == StakePhase.RELEASING && (now - stake.lastActionTimestamp) > releasingDuration) {
          stake.phase = StakePhase.READYTORELEASE;
        }
        return stake;
    }

    function getStakeBalance(address user) public view returns (uint256) {
        return getStake(user).amount;
    }

    function getStakePhase(address user) public view returns (StakePhase) {
        return getStake(user).phase;
    }
}
