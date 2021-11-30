// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;

interface IPoolFunctionality {
    function doSwapThroughOrionPool(
        address     user,
        uint112     amount_spend,
        uint112     amount_receive,
        address[]   calldata   path,
        bool        is_exact_spend,
        address     to
    ) external returns (uint amountOut, uint amountIn);

    function getWETH() external view returns (address);
}
