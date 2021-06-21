pragma solidity 0.6.12;

import "./interface/IMintBurnToken.sol";
import "./StakeAgentImpl.sol";
import "./StakeAgentUpgradeableProxy.sol";

import "openzeppelin-solidity/contracts/GSN/Context.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract StakeHubImpl is Context, Initializable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public rHT;
    address public stakeAgentImplAddr;
    address public stakeAgentProxyAdminMgr;
    address public communityTaxVault;

    address public constant validatorContractAddr = 0x000000000000000000000000000000000000f000;

    mapping(address => StakeAgentImpl) public userStakeAgentMap;

    uint256 public stakeFeeMolecular;
    uint256 public stakeFeeDenominator = 10000;
    uint256 public unstakeFeeMolecular;
    uint256 constant public unstakeFeeDenominator = 10000;

    address public admin;
    bool private _paused;
    uint256 public stakerCounter = 0;

    event Deposit(address from, uint256 amount);

    event Paused(address account);
    event Unpaused(address account);
    event NewAdmin(address indexed newAdmin);

    event LogStake(address indexed staker, uint256 amount);
    event LogUnstake(address indexed staker, uint256 amount);

    constructor() public {}

    /* solium-disable-next-line */
    receive () external payable {
        emit Deposit(msg.sender, msg.value);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin is allowed");
        _;
    }

    modifier whenNotPaused() {
        require(!paused(), "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(paused(), "Pausable: not paused");
        _;
    }

    function initialize(
        address _admin,
        address _rHT,
        address _stakeAgentImplAddr,
        address payable _communityTaxVault,
        address _stakeAgentProxyAdminMgr
    ) external initializer{
        admin = _admin;

        rHT = _rHT;
        stakeAgentImplAddr = _stakeAgentImplAddr;
        communityTaxVault = _communityTaxVault;
        stakeAgentProxyAdminMgr = _stakeAgentProxyAdminMgr;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function pause() external onlyAdmin whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    function unpause() external onlyAdmin whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }

    function setAdmin(address newAdmin_) external {
        require(msg.sender == admin, "setAdmin: Call must come from admin.");
        require(newAdmin_ != address(0x00), "setAdmin: Call must come from admin.");
        admin = newAdmin_;

        emit NewAdmin(newAdmin_);
    }

    function stake(uint256 amount, address validator) nonReentrant whenNotPaused external payable returns (bool) {
        uint256 stakeFee = amount.mul(stakeFeeMolecular).div(stakeFeeDenominator);
        require(amount.add(stakeFee)==msg.value, "msg.value should be equal to sum of stake amount and stake fee");
        StakeAgentImpl stakeAgent = userStakeAgentMap[msg.sender];
        if (address(stakeAgent) == address(0x0)) {
            StakeAgentUpgradeableProxy stakeAgentProxy = new StakeAgentUpgradeableProxy(stakeAgentImplAddr,stakeAgentProxyAdminMgr,"");
            stakeAgent = StakeAgentImpl(address(stakeAgentProxy));
            stakeAgent.initialize(msg.sender, address(this), communityTaxVault, validatorContractAddr);
            userStakeAgentMap[msg.sender] = stakeAgent;
            stakerCounter++;
        }
        stakeAgent.stake{value: amount}(validator);

        IMintBurnToken(rHT).mintTo(msg.sender, amount);
        communityTaxVault.call{value: stakeFee}("");
        emit LogStake(msg.sender, amount);
        return true;
    }

    function unstake(address validator) nonReentrant whenNotPaused external returns (bool) {
        StakeAgentImpl stakeAgent = userStakeAgentMap[msg.sender];
        require(address(stakeAgent)!=address(0x0),"user never stake");

        uint256 previousStakedAmount = stakeAgent.getStakeAmount(validator);
        IERC20(rHT).safeTransferFrom(msg.sender, address(this), previousStakedAmount);
        IMintBurnToken(rHT).burn(previousStakedAmount);

        stakeAgent.unstake(validator);

        emit LogStake(msg.sender, previousStakedAmount);
        return true;
    }

    function claimPendingUnstake(address validator) nonReentrant whenNotPaused external returns (bool) {
        StakeAgentImpl stakeAgent = userStakeAgentMap[msg.sender];
        require(address(stakeAgent)!=address(0x0),"user never stake");
        stakeAgent.claimPendingUnstake(validator);
        return true;
    }

    function claimStakeProfit() nonReentrant whenNotPaused external returns (bool) {
        StakeAgentImpl stakeAgent = userStakeAgentMap[msg.sender];
        require(address(stakeAgent)!=address(0x0),"user never stake");
        stakeAgent.claimStakeProfit();
        return true;
    }

    function pendingUnstakeClaimHeight(address validator, address staker) external view returns (uint256) {
        StakeAgentImpl stakeAgent = userStakeAgentMap[staker];
        if (address(stakeAgent)==address(0x0)) {
            return 0;
        }
        return stakeAgent.pendingUnstakeClaimHeight(validator);
    }

    function setStakeFeeRate(uint256 newStakeFeeMolecular) onlyAdmin external {
        if (newStakeFeeMolecular>0) {
            require(stakeFeeDenominator.div(newStakeFeeMolecular)>200, "stake fee rate must be less than 0.5%");
        }
        stakeFeeMolecular = newStakeFeeMolecular;
    }

    function setUnstakeFeeRate(uint256 newUnstakeFeeMolecular) onlyAdmin external {
        if (newUnstakeFeeMolecular>0) {
            require(unstakeFeeDenominator.div(newUnstakeFeeMolecular)>200, "unstake fee rate must be less than 0.5%");
        }
        unstakeFeeMolecular = newUnstakeFeeMolecular;
    }
}
