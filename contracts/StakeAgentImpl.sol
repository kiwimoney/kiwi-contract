pragma solidity 0.6.12;

import "./lib/Ownable.sol";
import "./interface/IHECOStake.sol";
import "./interface/IStakeHub.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";

contract StakeAgentImpl is Ownable,Initializable {
    using SafeMath for uint256;

    address payable public staker;
    address public stakeHub;
    address public communityTaxVault;
    address public validatorContractAddr;
    event Deposit(address from, uint256 amount);
    event WithdrawPendingUnstake(address to, uint256 amount);
    event WithdrawProfit(address to, uint256 amount);

    constructor() public {
    }

    function initialize(address payable _staker, address _stakeHub, address _communityTaxVault, address _validatorContractAddr) external initializer {
        staker = _staker;
        stakeHub = _stakeHub;
        communityTaxVault = _communityTaxVault;
        validatorContractAddr = _validatorContractAddr;
        super.initializeOwner(_stakeHub);
    }

    function stake(uint256 pid) onlyOwner external payable returns (bool) {
        IHECOStake(validatorContractAddr).vote{value: msg.value}(pid);
        return true;
    }

    function unstake(uint256 pid, uint256 amount) onlyOwner external returns (bool) {
        IHECOStake(validatorContractAddr).revokeVote(pid, amount);
        return true;
    }

    function pendingUnstakeClaimTime(uint256 pid) external view returns (uint256) {
        (,,uint256 lockingEndTime) = IHECOStake(validatorContractAddr).revokingInfo(pid, address(this));
        return lockingEndTime;
    }

    function getStakeAmount(uint256 pid) external view returns (uint256) {
        (uint256 amount,) = IHECOStake(validatorContractAddr).userInfo(pid, address(this));
        return amount;
    }

    function claimPendingUnstake(uint256 pid) onlyOwner external returns(bool) {
        require(IHECOStake(validatorContractAddr)._isWithdrawable(address(this), pid), "unstake is still in pending status");
        (uint256 revokingAmount,,) = IHECOStake(validatorContractAddr).revokingInfo(pid, address(this));

        uint256 unstakeFeeMolecular = IStakeHub(stakeHub).unstakeFeeMolecular();
        uint256 unstakeFeeDenominator = IStakeHub(stakeHub).unstakeFeeDenominator();
        uint256 unstakeFee = revokingAmount.mul(unstakeFeeMolecular).div(unstakeFeeDenominator);

        IHECOStake(validatorContractAddr).withdraw(pid);

        staker.call{value: revokingAmount.sub(unstakeFee)}("");
        communityTaxVault.call{value: unstakeFee}("");
        emit WithdrawPendingUnstake(staker, revokingAmount);
        return true;
    }

    function claimStakeProfit(uint256 pid) onlyOwner external returns(bool) {
        IHECOStake(validatorContractAddr).claimReward(pid);
        uint256 stakeProfit = address(this).balance;
        staker.call{value: stakeProfit}("");
        emit WithdrawProfit(staker, stakeProfit);
        return true;
    }
}
