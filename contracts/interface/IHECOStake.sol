pragma solidity ^0.6.0;

interface IHECOStake {
    function stake(address validator) external payable returns (bool);
    function unstake(address validator) external returns (bool);
    function withdrawStaking(address validator) external returns (bool);
    function getStakingInfo(address staker, address val) external view returns (uint256, uint256, uint256);
    function StakingLockPeriod() external view returns(uint64);
}