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



    function getStake(address user) public view returns (Stake memory stake){
        stake = stakingData[user];
        if(stake.phase == StakePhase.RELEASING && (block.timestamp - stake.lastActionTimestamp) > releasingDuration) {
          stake.phase = StakePhase.READYTORELEASE;
        }
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



    function postponeStakeRelease(address user) external onlyOwner{
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.FROZEN;
    }

    function allowStakeRelease(address user) external onlyOwner {
        Stake storage stake = stakingData[user];
        stake.phase = StakePhase.READYTORELEASE;
    }



    function requestReleaseStake() public {
        address user = _msgSender();
        Stake memory current = getStake(user);
        require(liabilities[user].length == 0, "Can not release stake: user has liabilities");
        Stake storage stake = stakingData[_msgSender()];
        if(current.phase == StakePhase.READYTORELEASE) {
          assetBalances[user][address(_orionToken)] += stake.amount;
          stake.amount = 0;
          stake.phase = StakePhase.NOTSTAKED;
        } else if (current.phase == StakePhase.LOCKED) {
          stake.phase = StakePhase.RELEASING;
          stake.lastActionTimestamp = uint64(block.timestamp);
        } else {
          revert("Can not release funds from this phase");
        }
    }

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

    function seizeFromStake(address user, address receiver, uint64 amount) public {
        require(msg.sender == address(this), "E14");
        Stake storage stake = stakingData[user];
        require(stake.amount >= amount, "UX"); //TODO
        stake.amount -= amount;
        assetBalances[receiver][address(_orionToken)] += amount;
    }

}

