pragma solidity ^0.6.0;
contract StakingInterface {
  function getLockedStakeBalance(address user) public view returns (uint256) {
  }
  function seizeFromStake(address user, address receiver, uint256 amount) external {
  }
}
