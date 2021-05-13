pragma solidity 0.6.12;

import "./interface/IStakeHub.sol";
import "./lib/Ownable.sol";
import "openzeppelin-solidity/contracts/proxy/Initializable.sol";

interface IUpgradeProxyContract {
    function upgradeTo(address newImplementation) external;
}

contract StakeAgentProxyAdminMgr is Ownable, Initializable {
    address public stakeAgentImpl;

    address public stakeHub;

    constructor () public {

    }

    function initialize(address _owner, address _stakeHub) public initializer {
        super.initializeOwner(_owner);

        stakeHub = _stakeHub;
    }

    function setNewStakeAgentImpl(address _stakeAgentImpl) onlyOwner external returns (bool) {
        stakeAgentImpl = _stakeAgentImpl;
        return true;
    }

    function upgradeStakeAgent() external returns (bool) {
        require(stakeAgentImpl!=address(0x0), "no new stakeAgent implementation");
        IUpgradeProxyContract stakeAgent = IUpgradeProxyContract(IStakeHub(stakeHub).userStakeAgentMap(msg.sender));
        require(address(stakeAgent)!=address(0x0), "empty stakeAgent");
        stakeAgent.upgradeTo(stakeAgentImpl);
        return true;
    }
}
