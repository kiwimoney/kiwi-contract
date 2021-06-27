const rHT = artifacts.require("rHT");
const KWI = artifacts.require("KWI");

const StakeAgentProxyAdminMgr = artifacts.require("StakeAgentProxyAdminMgr");
const StakeHub = artifacts.require("StakeHubImpl");
const StakeAgentImpl = artifacts.require("StakeAgentImpl");

const FarmRewardLock = artifacts.require("FarmRewardLock");
const FarmingCenter = artifacts.require("FarmingCenter");
const CommunityTaxVault = artifacts.require("CommunityTaxVault");

const Governor = artifacts.require("Governor");
const Timelock = artifacts.require("Timelock");

const MockNodeVoting = artifacts.require("NodeVoting");
const MockStakeAgentImpl = artifacts.require("MockStakeAgentImpl");

module.exports = function (deployer, network, accounts) {
  deployerAccount = accounts[0];
  initialGov = accounts[1];
  govGuardian = accounts[3];

  deployer.deploy(StakeHub).then(async () => {
    await deployer.deploy(FarmRewardLock);
    await deployer.deploy(FarmingCenter);

    await deployer.deploy(MockNodeVoting);
    await deployer.deploy(MockStakeAgentImpl);

    await deployer.deploy(StakeAgentProxyAdminMgr);
    await deployer.deploy(StakeAgentImpl);
    await deployer.deploy(CommunityTaxVault, initialGov);
    await deployer.deploy(rHT, initialGov);
    await deployer.deploy(KWI, initialGov);

    await deployer.deploy(Timelock, initialGov, 10);
    await deployer.deploy(Governor, Timelock.address, KWI.address, govGuardian);

    const stakeHubInst = await StakeHub.deployed();
    const farmRewardLockInst = await FarmRewardLock.deployed();
    const farmingCenterInst = await FarmingCenter.deployed();
    const stakeAgentProxyAdminMgrInst = await StakeAgentProxyAdminMgr.deployed();

    await stakeHubInst.initialize(initialGov, rHT.address, StakeAgentImpl.address, StakeAgentProxyAdminMgr.address, CommunityTaxVault.address, MockNodeVoting.address, {from: deployerAccount});
    await farmRewardLockInst.initialize(KWI.address, "113", "100", FarmingCenter.address, initialGov, {from: deployerAccount});
    await farmingCenterInst.initialize(initialGov, KWI.address, FarmRewardLock.address, 7, 10, {from: deployerAccount});
    await stakeAgentProxyAdminMgrInst.initialize(initialGov, StakeHub.address);
  });
};
