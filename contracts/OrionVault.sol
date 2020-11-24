pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ExchangeInterface.sol";

/**
 * @title OrionVault
 * @dev OrionVault contract for the Orion Protocol
 * @author @EmelyanenkoK
 */
contract OrionVault is Ownable {

    enum StakePhase{ NOTSTAKED, LOCKING, LOCKED, RELEASING, READYTORELEASE, FROZEN }

    struct Stake {
      uint64 amount; // 100m ORN in circulation fits uint64
      StakePhase phase;
      uint64 lastActionTimestamp;
    }

    uint64 constant lockingDuration = 0;
    uint64 constant releasingDuration = 3600*24;

    //Asset for staking
    IERC20 baseAsset;
    ExchangeInterface _exchange;

    // Get user balance by address and asset address
    mapping(address => Stake) private stakingData;


    constructor(address orionTokenAddress) public {
        baseAsset = IERC20(orionTokenAddress);
    }

    function setExchangeAddress(address exchange) external onlyOwner {
        _exchange = ExchangeInterface(exchange);
    }


    function moveFromBalance(uint64 amount) internal {
        require(baseAsset.transferFrom(address(_exchange), address(this), uint256(amount)), "E6");
        _exchange.moveToStake(_msgSender(),amount);
        Stake storage stake = stakingData[_msgSender()];
        stake.amount = amount;
    }

    function moveToBalance() internal {
        Stake storage stake = stakingData[_msgSender()];
        require(baseAsset.transfer(address(_exchange), uint256(stake.amount)), "E6");
        _exchange.moveFromStake(_msgSender(), stake.amount);
        stake.amount = 0;
    }

    function seizeFromStake(address user, address receiver, uint64 amount) external {
        require(_msgSender() == address(_exchange), "Unauthorized seizeFromStake");
        Stake storage stake = stakingData[user];
        require(stake.amount >= amount, "UX"); //TODO
        stake.amount -= amount;
        require(baseAsset.transfer(address(_exchange), amount), "E6");
        _exchange.moveFromStake(receiver, amount);
    }


    function lockStake(uint64 amount) external {
        assert(getStakePhase(_msgSender()) == StakePhase.NOTSTAKED);
        moveFromBalance(amount);
        Stake storage stake = stakingData[_msgSender()];
        stake.phase = StakePhase.LOCKING;
        stake.lastActionTimestamp = uint64(now);
    }

    function checkLiabilityAbsence(address user) internal returns (bool) {
      try _exchange.liabilities(user,0) {
        return false;
      } catch {
        return true;
      }
    }

    function requestReleaseStake() external {
        StakePhase currentPhase = getStakePhase(_msgSender());
        require(checkLiabilityAbsence(_msgSender()), "Can not release stake: user has liabilities");
        if(currentPhase == StakePhase.LOCKING || currentPhase == StakePhase.READYTORELEASE) {
          moveToBalance();
          Stake storage stake = stakingData[_msgSender()];
          stake.phase = StakePhase.NOTSTAKED;
        } else if (currentPhase == StakePhase.LOCKED) {
          Stake storage stake = stakingData[_msgSender()];
          stake.phase = StakePhase.RELEASING;
          stake.lastActionTimestamp = uint64(now);
        } else {
          revert("Can not release funds from this phase");
        }

    }

    function postponeStakeRelease(address user) external onlyOwner{
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.FROZEN;
    }

    function allowStakeRelease(address user) external onlyOwner {
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.READYTORELEASE;
    }

    function seize(address user, address receiver) external onlyOwner {
    }

    function getStake(address user) public view returns (Stake memory){
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

    function getLockedStakeBalance(address user) public view returns (uint256) {
      Stake memory stake = getStake(user);
      if(stake.phase == StakePhase.LOCKED || stake.phase == StakePhase.FROZEN)
        return stake.amount;
      return 0;
    }
}
