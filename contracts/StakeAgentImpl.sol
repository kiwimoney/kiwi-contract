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

    function stake(address validator) onlyOwner external payable returns (bool) {
        IHECOStake(validatorContractAddr).stake{value: msg.value}(validator);
        return true;
    }

    function unstake(address validator) onlyOwner external returns (bool) {
        IHECOStake(validatorContractAddr).unstake(validator);
        return true;
    }

    function pendingUnstakeClaimHeight(address validator) external view returns (uint256) {
        (uint256 amount, uint256 unstakeBlock,) = IHECOStake(validatorContractAddr).getStakingInfo(address(this), validator);
        uint256 stakingLockPeriod = IHECOStake(validatorContractAddr).StakingLockPeriod();
        if (amount > 0) {
            return unstakeBlock.add(stakingLockPeriod);
        }
        return 0;
    }

    function getStakeAmount(address validator) external view returns (uint256) {
        (uint256 amount,,) = IHECOStake(validatorContractAddr).getStakingInfo(address(this), validator);
        return amount;
    }

    function claimPendingUnstake(address validator) onlyOwner external returns(bool) {
        (uint256 amount,,) = IHECOStake(validatorContractAddr).getStakingInfo(address(this), validator);
        require(amount > 0, "no pending unstake");

        uint256 unstakeFeeMolecular = IStakeHub(stakeHub).unstakeFeeMolecular();
        uint256 unstakeFeeDenominator = IStakeHub(stakeHub).unstakeFeeDenominator();
        uint256 unstakeFee = amount.mul(unstakeFeeMolecular).div(unstakeFeeDenominator);

        IHECOStake(validatorContractAddr).withdrawStaking(validator);
        staker.call{value: amount.sub(unstakeFee)}("");
        communityTaxVault.call{value: unstakeFee}("");
        emit WithdrawPendingUnstake(staker, amount);
        return true;
    }

    function claimStakeProfit() onlyOwner external returns(bool) {
        uint256 stakeProfit = address(this).balance;
        staker.call{value: stakeProfit}("");
        emit WithdrawProfit(staker, stakeProfit);
        return true;
    }
}
