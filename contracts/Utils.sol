pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "./libs/LibUnitConverter.sol";

contract Utils is Context {
    using SafeMath for uint256;

    uint256 private _guardCounter;

    constructor() internal {
        // The counter starts at one to prevent changing it from zero to a non-zero
        // value, which is a more expensive operation.
        _guardCounter = 1;
    }

    /**
     * @dev OpenZeppelin ReentrancyGuard
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 localCounter = _guardCounter;
        _;
        require(localCounter == _guardCounter, "reentrant call");
    }

    /**
        @notice Retrieve sender of transaction
        @dev Provides information about the current execution context, including the
        sender of the transaction and its data. While these are generally available
        via msg.sender and msg.data, they should not be accessed in such a direct
        manner, since when dealing with GSN meta-transactions the account sending and
        paying for execution may not be the actual sender (as far as an application
        is concerned).
     */
    /* Defined in GSN
    function _msgSender() internal view returns (address payable) {
        return msg.sender;
    }
    */

    function safeTransfer(
        address to,
        address assetAddress,
        uint256 _amount
    ) internal {
        uint256 amount = LibUnitConverter.decimalToBaseUnit(
            assetAddress,
            _amount
        );

        if (assetAddress == address(0)) {
            uint256 balanceBeforeTransfer = address(this).balance;
            // solhint-disable-next-line
            (bool success, ) = to.call.value(amount)("");
            require(success, "E6");
            assert(address(this).balance == balanceBeforeTransfer.sub(amount));
        } else {
            ERC20 asset = ERC20(assetAddress);
            uint256 balanceBeforeTransfer = asset.balanceOf(address(this));
            require(asset.transfer(_msgSender(), amount), "E6");
            assert(
                asset.balanceOf(address(this)) ==
                    balanceBeforeTransfer.sub(amount)
            );
        }
    }
}
