pragma solidity ^0.7.0;
import "@openzeppelin/contracts/access/Ownable.sol";


contract AggregatorV3InterfaceStub is Ownable {

  uint80 roundId;
  int256 answer;
  uint256 startedAt;
  uint256 updatedAt;
  uint80 answeredInRound;
  uint8 _decimals;


  function setData(uint80 _roundId,
                   int256 _answer,
                   uint256 _startedAt,
                   uint256 _updatedAt,
                   uint80 _answeredInRound,
                   uint8 __decimals) public onlyOwner {
      roundId = _roundId;
      answer = _answer;
      startedAt = _startedAt;
      updatedAt = _updatedAt;
      answeredInRound = _answeredInRound;
      _decimals = __decimals;
  }

  function decimals() external view returns (uint8) {
    return _decimals;
  }
  function latestRoundData()
    external
    view
    returns ( uint80, int256, uint256, uint256, uint80 ) {
    return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

}

