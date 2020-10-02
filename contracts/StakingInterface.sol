pragma solidity ^0.6.0;
contract StakingInterface {
  function getLockedStakeBalance(address user) public view returns (uint64) {
  }
  function seizeFromStake(address user, address receiver, uint64 amount) external {
  }
}
