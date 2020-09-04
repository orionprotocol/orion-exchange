pragma solidity 0.5.10;
import "@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title Staking
 * @dev Staking contract for the Orion Protocol
 * @author @EmelyanenkoK
 */
contract Staking is Ownable {

    //Asset for staking
    address baseAssetAddress;

    constructor(address orionTokenAddress) internal {
        baseAssetAddress = orionTokenAddress;
    }

    function lockStake(uint256 amount) external {
    }

    function requestReleaseStake() external {
    }

    function postponeStakeRelease(address user) external {
    }

    function allowStakeRelease(address user) external {
    }

    function seize(address user, address receiver) external {
    }

    function getStake(address user) public view {
    }

    function getStakeBalance(address user) public view returns (uint256) {
    }

    function getStakePhase(address user) public view returns (uint256) {
    }
}
