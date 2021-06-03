pragma solidity >=0.5.0;

interface IOrionPoolV2Migrator {
    function migrate(address token, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external;
}
