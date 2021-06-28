pragma solidity ^0.6.0;

interface IHECOStake {
    function vote(uint256 _pid) external payable;
    function revokeVote(uint256 _pid, uint256 _amount) external;
    function withdraw(uint _pid) external;
    function claimReward(uint256 _pid) external;
    function userInfo(uint _pid, address user) external view returns (uint256 amount, uint256 rewardDebt);
    function revokingInfo(address user, uint _pid) external view returns (uint256 amount, uint256 status, uint256 lockingEndTime);
    function _isWithdrawable(address _user, uint256 _pid) external view returns (bool);
    function pendingReward(uint256 _pid, address _user) external view returns (uint256);
}