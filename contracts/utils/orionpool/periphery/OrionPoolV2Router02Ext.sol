pragma solidity >0.7.0;

import './OrionPoolV2Router02.sol';
import './interfaces/IOrionPoolV2Router02Ext.sol';

contract OrionPoolV2Router02Ext is OrionPoolV2Router02, IOrionPoolV2Router02Ext {
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
        OrionPoolV2Router02(_factory, _WETH)
    {
    }

    function swapExactTokensForTokensAutoRoute(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external payable override returns (uint[] memory amounts)
    {
        if(path[0] == address(0))
        {
            //  We completely ignore amountIn there

            address[] memory new_path = new address[](path.length);
            new_path[0] = WETH;
            for(uint I = 1; I < path.length; ++I)
                new_path[I] = path[I];

            //  return this.swapExactETHForTokens{value: amountIn}(amountOutMin, new_path, to, block.timestamp + 86400);
            amounts = OrionPoolV2Library.getAmountsOut(
                factory,
                msg.value,
                new_path);
            require(amounts[amounts.length - 1] >= amountOutMin, 'OrionPoolV2Router: IOA_2');
            IWETH(WETH).deposit{value: amounts[0]}();
            assert(IWETH(WETH).transfer(OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]));
            _swap(amounts, new_path, to);

            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                msg.value,
                msg.value,
                amountOutMin,
                amounts[amounts.length - 1]
            );
        }
        else if(path[path.length - 1] == address(0))
        {
            require(msg.value == 0, "NPF1");

            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length-1; ++I)
                new_path[I] = path[I];
            new_path[path.length - 1] = WETH;

            //  return this.swapExactTokensForETH(amountIn, amountOutMin, new_path, to, block.timestamp + 86400);
            //  require(path[path.length - 1] == WETH, 'OrionPoolV2Router: INVALID_PATH');
            amounts = OrionPoolV2Library.getAmountsOut(factory, amountIn, new_path);
            require(amounts[amounts.length - 1] >= amountOutMin, 'OrionPoolV2Router: IOA_3');
            TransferHelper.safeTransferFrom(
                new_path[0], msg.sender, OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]
            );
            _swap(amounts, new_path, address(this));
            IWETH(WETH).withdraw(amounts[amounts.length - 1]);
            TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);

            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                amountIn,
                amountIn,
                amountOutMin,
                amounts[amounts.length - 1]
            );
        }
        else
        {
            require(msg.value == 0, "NPF1");

            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length; ++I)
            {
                if(path[I] != address(0))
                    new_path[I] = path[I];
                else
                    new_path[I] = WETH;
            }

            amounts = OrionPoolV2Library.getAmountsOut(factory, amountIn, new_path);
            require(amounts[amounts.length - 1] >= amountOutMin, 'OrionPoolV2Router: IOA_4');
            TransferHelper.safeTransferFrom(
                path[0], msg.sender, OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]
            );
            _swap(amounts, new_path, to);
            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                amountIn,
                amountIn,
                amountOutMin,
                amounts[amounts.length - 1]
            );
        }
    }

    ///////////////////////////////////////
    function swapTokensForExactTokensAutoRoute(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to
    ) external payable override returns (uint[] memory amounts)
    {
        if(path[0] == address(0))
        {
            address[] memory new_path = new address[](path.length);
            new_path[0] = WETH;
            for(uint I = 1; I < path.length; ++I)
                new_path[I] = path[I];

            //  We completely ignore amountInMax there

            //  return this.swapETHForExactTokens{value: amountInMax}(amountOut, new_path, to, block.timestamp + 86400);
            //  require(path[0] == WETH, 'OrionPoolV2Router: INVALID_PATH');
            amounts = OrionPoolV2Library.getAmountsIn(factory, amountOut, new_path);
            require(amounts[0] <= msg.value, 'OrionPoolV2Router: EIA_2');
            IWETH(WETH).deposit{value: amounts[0]}();
            assert(IWETH(WETH).transfer(OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]));
            _swap(amounts, new_path, to);
            // refund dust eth, if any
            if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                msg.value,
                amounts[0],
                amountOut,
                amountOut
            );
        }
        else if(path[path.length - 1] == address(0))
        {
            require(msg.value == 0, "NPF1");

            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length-1; ++I)
                new_path[I] = path[I];
            new_path[path.length - 1] = WETH;

            //  return this.swapTokensForExactETH(amountOut, amountInMax, new_path, to, block.timestamp + 86400);
            //  require(path[path.length - 1] == WETH, 'OrionPoolV2Router: INVALID_PATH');
            amounts = OrionPoolV2Library.getAmountsIn(factory, amountOut, new_path);
            require(amounts[0] <= amountInMax, 'OrionPoolV2Router: EIA_3');
            TransferHelper.safeTransferFrom(
                new_path[0], msg.sender, OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]
            );
            _swap(amounts, new_path, address(this));
            IWETH(WETH).withdraw(amounts[amounts.length - 1]);
            TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                amountInMax,
                amounts[0],
                amountOut,
                amountOut
            );
        }
        else
        {
            require(msg.value == 0, "NPF1");

            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length; ++I)
            {
                if(path[I] != address(0))
                    new_path[I] = path[I];
                else
                    new_path[I] = WETH;
            }

            //  return this.swapTokensForExactTokens(amountOut, amountInMax, path,to, block.timestamp + 86400);
            amounts = OrionPoolV2Library.getAmountsIn(factory, amountOut, new_path);
            require(amounts[0] <= amountInMax, 'OrionPoolV2Router: EIA_4');
            TransferHelper.safeTransferFrom(
                new_path[0], msg.sender, OrionPoolV2Library.pairFor(factory, new_path[0], new_path[1]), amounts[0]
            );
            _swap(amounts, new_path, to);
            emit OrionPoolSwap
            (
                tx.origin,
                path[0],
                path[path.length-1],
                amountInMax,
                amounts[0],
                amountOut,
                amountOut
            );
        }
    }
/*
    function swapExactTokensForTokensAutoRoute(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external override returns (uint[] memory amounts)
    {
        if(path[0] == address(0))
        {
            address[] memory new_path = new address[](path.length);
            new_path[0] = WETH;
            for(uint I = 1; I < path.length; ++I)
                new_path[I] = path[I];
            return this.swapExactETHForTokens{value: amountIn}(amountOutMin, new_path, to, block.timestamp + 86400);
        }

        if(path[path.length - 1] == address(0))
        {
            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length-1; ++I)
                new_path[I] = path[I];
            new_path[path.length - 1] = WETH;

            return this.swapExactTokensForETH(amountIn, amountOutMin, new_path, to, block.timestamp + 86400);
        }

        return this.swapExactTokensForTokens(amountIn, amountOutMin, path, to, block.timestamp + 86400);
    }

    function swapTokensForExactTokensAutoRoute(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to
    ) external override returns (uint[] memory amounts)
    {
        if(path[0] == address(0))
        {
            address[] memory new_path = new address[](path.length);
            new_path[0] = WETH;
            for(uint I = 1; I < path.length; ++I)
                new_path[I] = path[I];

            return this.swapETHForExactTokens{value: amountInMax}(amountOut, new_path, to, block.timestamp + 86400);
        }

        if(path[path.length - 1] == address(0))
        {
            address[] memory new_path = new address[](path.length);
            for(uint I = 0; I < path.length-1; ++I)
                new_path[I] = path[I];
            new_path[path.length - 1] = WETH;

            return this.swapTokensForExactETH(amountOut, amountInMax, new_path, to, block.timestamp + 86400);
        }

        return this.swapTokensForExactTokens(amountOut, amountInMax, path,to, block.timestamp + 86400);
    }
*/
}
