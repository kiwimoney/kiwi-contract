pragma solidity ^0.6.0;

interface IStakeHub {
    function userStakeAgentMap(address staker) external returns(address);
    function stakeFeeMolecular() external returns(uint256);
    function stakeFeeDenominator() external returns(uint256);
    function unstakeFeeMolecular() external returns(uint256);
    function unstakeFeeDenominator() external returns(uint256);
}