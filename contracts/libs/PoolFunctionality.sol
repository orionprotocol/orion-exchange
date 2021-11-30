// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import "../interfaces/IPoolFunctionality.sol";
import "../interfaces/IPoolSwapCallback.sol";
import "./SafeTransferHelper.sol";
import "../utils/orionpool/periphery/interfaces/IOrionPoolV2Router02Ext.sol";
import "../utils/orionpool/periphery/libraries/OrionPoolV2Library.sol";
import "../utils/orionpool/periphery/OrionPoolV2Router02.sol";

contract PoolFunctionality is OrionPoolV2Router02, IPoolFunctionality {
    using SafeMath for uint;

    event OrionPoolSwap(
        address sender,
        address st,
        address rt,
        uint256 st_r,
        uint256 st_a,
        uint256 rt_r,
        uint256 rt_a
    );

    constructor(address _factory, address _WETH)
        OrionPoolV2Router02(_factory, _WETH) {
    }

    function getWETH() external view override returns (address) {
        return WETH;
    }

    function doSwapThroughOrionPool(
        address     user,
        uint112     amount_spend,
        uint112     amount_receive,
        address[] calldata   path,
        bool        is_exact_spend,
        address     to
    ) external override returns (uint amountOut, uint amountIn) {
        (uint amount_spend_base_units, uint amount_receive_base_units) =
            (
                decimalToBaseUnit(path[0], amount_spend),
                decimalToBaseUnit(path[path.length-1], amount_receive)
            );

        uint[] memory amounts_base_units = _doSwapTokens(
                user,
                amount_spend_base_units,
                amount_receive_base_units,
                path,
                is_exact_spend,
                to
            );

        //  Anyway user gave amounts[0] and received amounts[len-1]
        amountOut = baseUnitToDecimal(path[0], amounts_base_units[0]);
        amountIn = baseUnitToDecimal(path[path.length-1], amounts_base_units[path.length-1]);
    }

    function _doSwapTokens(
        address user,
        uint amountIn,
        uint amountOut,
        address[] calldata path,
        bool isExactIn, //if true - SwapExactTokensForTokens else SwapTokensForExactTokens
        address to
    ) internal returns (uint[] memory amounts) {
        address[] memory new_path = new address[](path.length);
        for (uint i = 0; i < path.length; ++i) {
            new_path[i] = path[i] == address(0) ? WETH : path[i];
        }

        bool isToContract = path[path.length - 1] == address(0);
        address toAuto = isToContract ?  address(this) : to;

        if (isExactIn) {
            amounts = OrionPoolV2Library.getAmountsOut(factory, amountIn, new_path);
            require(amounts[amounts.length - 1] >= amountOut, 'PoolFunctionality: IOA');
        } else {
            amounts = OrionPoolV2Library.getAmountsIn(factory, amountOut, new_path);
            require(amounts[0] <= amountIn, 'PoolFunctionality: EIA');
        }

        IPoolSwapCallback(msg.sender).safeAutoTransferFrom(path[0], user,
            OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]);

        _swap(amounts, new_path, toAuto);

        if (isToContract) {
            SafeTransferHelper.safeAutoTransferTo(WETH, path[path.length - 1], to, amounts[amounts.length - 1]);
        }

        emit OrionPoolSwap(
            tx.origin,
            path[0],
            path[path.length-1],
            amountIn,
            amounts[0],
            amountOut,
            amounts[amounts.length - 1]
        );
    }

    /**
        @notice convert asset amount from8 decimals (10^8) to its base unit
     */
    function decimalToBaseUnit(address assetAddress, uint amount) internal view returns(uint112 baseValue) {
        uint256 result;

        if(assetAddress == address(0)){
            result = amount.mul(1 ether).div(10**8); // 18 decimals
        } else {
            uint decimals = ERC20(assetAddress).decimals();

            result = amount.mul(10**decimals).div(10**8);
        }

        require(result < uint256(type(uint112).max), "E3U");
        baseValue = uint112(result);
    }

    /**
        @notice convert asset amount from its base unit to 8 decimals (10^8)
     */
    function baseUnitToDecimal(address assetAddress, uint amount) internal view returns(uint112 decimalValue) {
        uint256 result;

        if(assetAddress == address(0)){
            result = amount.mul(10**8).div(1 ether);
        } else {
            uint decimals = ERC20(assetAddress).decimals();

            result = amount.mul(10**8).div(10**decimals);
        }
        require(result < uint256(type(uint112).max), "E3U");
        decimalValue = uint112(result);
    }
}
