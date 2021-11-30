// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';
import './Mintable.sol';
import "../utils/orionpool/periphery/interfaces/IWETH.sol";
import '../interfaces/IWETH9.sol';
import "hardhat/console.sol";

contract WETH is Mintable, IWETH9 {
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    constructor()
    ERC20("Wrapped Ether", "WETH")
    ERC20Capped(100e6 * 1 ether) public {
    }

    receive() external payable {
        deposit();
    }
    function deposit() override public payable {
        console.log("WETH deposit %s %s", msg.sender, msg.value);
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        super._transfer(_msgSender(), recipient, amount);
        return true;
    }

    function withdraw(uint wad) override public {
        require(balanceOf(msg.sender) >= wad);
        console.log("WETH withdraw %s %s %s", msg.sender, wad, address(this).balance);
        _burn(msg.sender, wad);
        (bool success, ) = msg.sender.call{value: wad}("");
        require(success, "Not enough ETH");
        emit Withdrawal(msg.sender, wad);
    }
}
