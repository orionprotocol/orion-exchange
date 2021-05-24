pragma solidity 0.7.4;

interface OrionVaultInterface {

    /**
     * @dev Returns locked or frozen stake balance only
     * @param user address
     */
    function getLockedStakeBalance(address user) external view returns (uint64);

    /**
     * @dev send some orion from user's stake to receiver balance
     * @dev This function is used during liquidations, to reimburse liquidator
     *      with orions from stake for decreasing liabilities.
     * @param user - user whose stake will be decreased
     * @param receiver - user which get orions
     * @param amount - amount of withdrawn tokens
     */
    function seizeFromStake(address user, address receiver, uint64 amount) external;

}
