const { expectRevert, time } = require('@openzeppelin/test-helpers');

const RHT = artifacts.require("RHT");
const KWI = artifacts.require("KWI");
const StakeHub = artifacts.require("StakeHubImpl");
const StakeAgentProxyAdminMgr = artifacts.require("StakeAgentProxyAdminMgr");
const CommunityTaxVault = artifacts.require("CommunityTaxVault");
const FarmRewardLock = artifacts.require("FarmRewardLock");
const FarmingCenter = artifacts.require("FarmingCenter");

const Governor = artifacts.require("Governor");
const Timelock = artifacts.require("Timelock");

const MockValidators = artifacts.require("MockValidators");
const MockStakeAgentImpl = artifacts.require("MockStakeAgentImpl");

const Web3 = require('web3');
const truffleAssert = require('truffle-assertions');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

contract('StakeHub Contract', (accounts) => {
    it('Test Init', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        validator0 = accounts[4];
        validator1 = accounts[5];
        admin = accounts[6];
        player0 = accounts[7];
        player1 = accounts[8];
        player2 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();
        const rhtInst = await RHT.deployed();
        const mockValidatorsInst = await MockValidators.deployed();

        await mockValidatorsInst.initialize([validator0, validator1], {from: deployerAccount});

        const rhtName = await rhtInst.name();
        assert.equal(rhtName, "Reward HT", "wrong name");
        const rhtSymbol = await rhtInst.symbol();
        assert.equal(rhtSymbol, "rHT", "wrong symbol");
        const rhtDecimals = await rhtInst.decimals();
        assert.equal(rhtDecimals, "18", "wrong decimals");
        const totalSupply = await rhtInst.totalSupply();
        assert.equal(totalSupply.toString(), "0", "wrong total supply");
        let rhtOwner = await rhtInst.owner();
        assert.equal(rhtOwner.toString(), initialGov, "wrong owner");

        await rhtInst.transferOwnership(StakeHub.address, {from: initialGov});
        rhtOwner = await rhtInst.owner();
        assert.equal(rhtOwner.toString(), StakeHub.address, "wrong owner");
    });

    it('Test stake and unstake', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        validator0 = accounts[4];
        validator1 = accounts[5];
        admin = accounts[6];
        player0 = accounts[7];
        player1 = accounts[8];
        player2 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();
        const rhtInst = await RHT.deployed();
        const mockValidatorsInst = await MockValidators.deployed();

        await stakeHubInst.stake(web3.utils.toBN(2e18), validator0, {from: player0, value: web3.utils.toBN(2001e15)});
        let rhtBalance = await rhtInst.balanceOf(player0);
        assert.equal(rhtBalance.toString(), web3.utils.toBN(2e18).toString(), "wrong rht balance");

        const stakeAgent = await stakeHubInst.userStakeAgentMap(player0);
        await web3.eth.sendTransaction({ from: validator0, to: stakeAgent, value: web3.utils.toBN(1e17), chainId: 666})

        let originalBalance = await web3.eth.getBalance(player0);
        await stakeHubInst.claimStakeProfit({from: player0});
        let newBalance = await web3.eth.getBalance(player0);
        assert.equal(web3.utils.toBN(newBalance).gte(web3.utils.toBN(originalBalance)), true, "balance should be increased");

        await rhtInst.approve(StakeHub.address, web3.utils.toBN(2e18), {from: player0});
        await stakeHubInst.unstake(validator0, {from: player0});
        const height = await web3.eth.getBlockNumber();

        const claimHeight = await stakeHubInst.pendingUnstakeClaimHeight(validator0, player0);
        assert.equal(claimHeight.toString(), web3.utils.toBN(height).add(web3.utils.toBN(32)).toString(), "wrong claim height");

        rhtBalance = await rhtInst.balanceOf(player0);
        assert.equal(rhtBalance.toString(), "0", "wrong rht balance");

        await time.advanceBlockTo(claimHeight);
        originalBalance = await web3.eth.getBalance(player0);
        await stakeHubInst.claimPendingUnstake(validator0, {from: player0});
        newBalance = await web3.eth.getBalance(player0);
        assert.equal(web3.utils.toBN(newBalance).gte(web3.utils.toBN(originalBalance)), true, "balance should be increased");

        let communityTaxVaultBalance = await web3.eth.getBalance(CommunityTaxVault.address);
        assert.equal(communityTaxVaultBalance.toString(), "2000000000000000", "wrong communityTaxVault Balance");

        const communityTaxVaultInst = await CommunityTaxVault.deployed();
        await communityTaxVaultInst.claim(web3.utils.toBN("20000000000000000"), initialGov, {from: initialGov});
        communityTaxVaultBalance = await web3.eth.getBalance(CommunityTaxVault.address);
        assert.equal(communityTaxVaultBalance.toString(), "0", "wrong communityTaxVault Balance");
    });
    it('Test pause', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        validator0 = accounts[4];
        validator1 = accounts[5];
        admin = accounts[6];
        player0 = accounts[7];
        player1 = accounts[8];
        player2 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();

        let paused = await stakeHubInst.paused();
        assert.equal(paused, false,"wrong paused");

        await stakeHubInst.pause({from: initialGov});
        paused = await stakeHubInst.paused();
        assert.equal(paused, true,"wrong paused");

        try {
            await stakeHubInst.stake(web3.utils.toBN(2e18), validator0, {from: player1, value: 2001e15});
            assert.fail();
        } catch (error) {
            assert.ok(error.toString().includes("Pausable: paused"));
        }

        try {
            await stakeHubInst.unstake(validator0, {from: player1});
            assert.fail();
        } catch (error) {
            assert.ok(error.toString().includes("Pausable: paused"));
        }

        await stakeHubInst.unpause({from: initialGov});
        paused = await stakeHubInst.paused();
        assert.equal(paused, false,"wrong paused");

        const stakeTx0 = await stakeHubInst.stake(web3.utils.toBN(2e18), validator1, {from: player1, value: 2001e15});
        truffleAssert.eventEmitted(stakeTx0, "LogStake",(ev) => {
            return ev.staker.toLowerCase() === player1.toLowerCase();
        });
    });
    it('Test upgrade stake agent', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        validator0 = accounts[4];
        validator1 = accounts[5];
        admin = accounts[6];
        player0 = accounts[7];
        player1 = accounts[8];
        player2 = accounts[9];

        const stakeAgentProxyAdminMgrInst =  await StakeAgentProxyAdminMgr.deployed();

        try {
            await stakeAgentProxyAdminMgrInst.upgradeStakeAgent({from: player0});
            assert.fail();
        } catch (error) {
            assert.ok(error.toString().includes("no new stakeAgent implementation"));
        }

        stakeAgentProxyAdminMgrInst.setNewStakeAgentImpl(MockStakeAgentImpl.address, {from: initialGov});

        try {
            await stakeAgentProxyAdminMgrInst.upgradeStakeAgent({from: player2});
            assert.fail()
        } catch (error) {
            assert.ok(error.toString().includes("empty stakeAgent"));
        }

        await stakeAgentProxyAdminMgrInst.upgradeStakeAgent({from: player0});
    });
    it('Test CommunityTaxVault', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        validator0 = accounts[4];
        validator1 = accounts[5];
        admin = accounts[6];
        player0 = accounts[7];
        player1 = accounts[8];
        player2 = accounts[9];

        const communityTaxVaultInst = await CommunityTaxVault.deployed();

        try {
            await communityTaxVaultInst.transferGovernorship(Governor.address, {from: player2});
            assert.fail()
        } catch (error) {
            assert.ok(error.toString().includes("only governance is allowed"));
        }

        try {
            await communityTaxVaultInst.transferGovernorship("0x0000000000000000000000000000000000000000", {from: initialGov});
            assert.fail()
        } catch (error) {
            assert.ok(error.toString().includes("new governor is zero address"));
        }

        await communityTaxVaultInst.transferGovernorship(Governor.address, {from: initialGov});

        const newGov = await communityTaxVaultInst.governor();
        assert.equal(newGov.toString(), Governor.address.toString(), "wrong governance address");
    });
});