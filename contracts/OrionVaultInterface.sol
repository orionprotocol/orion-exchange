pragma solidity ^0.7.0;
contract OrionVaultInterface {
  function getLockedStakeBalance(address user) public view returns (uint64) {
  }
  function seizeFromStake(address user, address receiver, uint64 amount) external {
  }
}
