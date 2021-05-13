const { expectRevert, time } = require('@openzeppelin/test-helpers');

const RHT = artifacts.require("RHT");
const KWI = artifacts.require("KWI");

const StakeHub = artifacts.require("StakeHubImpl");

const FarmRewardLock = artifacts.require("FarmRewardLock");
const FarmingCenter = artifacts.require("FarmingCenter");

const Governor = artifacts.require("Governor");
const Timelock = artifacts.require("Timelock");

const Web3 = require('web3');
const truffleAssert = require('truffle-assertions');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const tokenPrecision = web3.utils.toBN(1e18);
let farmingEndHeight;

let player0InitialKWIBalance;
let player1InitialKWIBalance;
let player2InitialKWIBalance;
let govInitialKWIBalance;

contract('FarmingCenter Contract', (accounts) => {
    it('Test Deposit KWI', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        govGuardian = accounts[3];
        bcStakingTSS = accounts[4];
        player0 = accounts[5];
        player1 = accounts[6];
        player2 = accounts[7];
        player3 = accounts[8];
        player4 = accounts[9];

        await time.advanceBlock();

        const kwiInst = await KWI.deployed();
        const farmingCenterInst = await FarmingCenter.deployed();

        const kwiName = await kwiInst.name();
        assert.equal(kwiName, "KiwiMoney", "wrong name");
        const kwiSymbol = await kwiInst.symbol();
        assert.equal(kwiSymbol, "KWI", "wrong symbol");
        const kwiDecimals = await kwiInst.decimals();
        assert.equal(kwiDecimals, "18", "wrong decimals");
        const kwiTotalSupply = await kwiInst.totalSupply();
        assert.equal(kwiTotalSupply, web3.utils.toBN(1e10).mul(tokenPrecision).toString(), "wrong total supply");
        const kwiOwner = await kwiInst.owner();
        assert.equal(kwiOwner.toString(), initialGov.toString(), "wrong owner");

        await kwiInst.transfer(player0, web3.utils.toBN("10000").mul(tokenPrecision), {from: initialGov});
        await kwiInst.transfer(player1, web3.utils.toBN("20000").mul(tokenPrecision), {from: initialGov});
        await kwiInst.transfer(player2, web3.utils.toBN("30000").mul(tokenPrecision), {from: initialGov});
        await kwiInst.transfer(player3, web3.utils.toBN("40000").mul(tokenPrecision), {from: initialGov});
        await kwiInst.transfer(player4, web3.utils.toBN("50000").mul(tokenPrecision), {from: initialGov});

        player0InitialKWIBalance = await kwiInst.balanceOf(player0);
        player1InitialKWIBalance = await kwiInst.balanceOf(player1);
        player2InitialKWIBalance = await kwiInst.balanceOf(player2);
        govInitialKWIBalance = await kwiInst.balanceOf(initialGov);

        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN("10000").mul(tokenPrecision), {from: player0});
        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN("20000").mul(tokenPrecision), {from: player1});
        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN("30000").mul(tokenPrecision), {from: player2});
        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN("40000").mul(tokenPrecision), {from: player3});
        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN("50000").mul(tokenPrecision), {from: player4});

        await kwiInst.approve(FarmingCenter.address, web3.utils.toBN(1e8).mul(tokenPrecision), {from: initialGov});
        await time.advanceBlock();
        await time.advanceBlock();
        const currentHeight =  await time.latestBlock();
        await farmingCenterInst.addNewFarmingPeriod(
            200,
            currentHeight.add(web3.utils.toBN(10)),
            web3.utils.toBN(20).mul(tokenPrecision),
            {from: initialGov});

        farmingEndHeight = currentHeight.add(web3.utils.toBN(210))

        await farmingCenterInst.deposit(0, web3.utils.toBN("10").mul(tokenPrecision), {from: player0});

        await time.advanceBlockTo(currentHeight.add(web3.utils.toBN(10)));

        let pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(0, player0);
        assert.equal(pendingKWIPlayer0, "0", "wrong pending KWI");

        await time.advanceBlock();
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(0, player0);
        assert.equal(pendingKWIPlayer0.toString(), web3.utils.toBN("20").mul(tokenPrecision).toString(), "wrong pending KWI");

        await time.advanceBlock();
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(0, player0);
        assert.equal(pendingKWIPlayer0.toString(), web3.utils.toBN("40").mul(tokenPrecision).toString(), "wrong pending KWI");

        await farmingCenterInst.deposit(0, web3.utils.toBN("20").mul(tokenPrecision), {from: player1});
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(0, player0);
        assert.equal(pendingKWIPlayer0.toString(), web3.utils.toBN("60").mul(tokenPrecision).toString(), "wrong pending KWI");
        let pendingKWIPlayer1 = await farmingCenterInst.pendingKWI(0, player1);
        assert.equal(pendingKWIPlayer1.toString(), "0", "wrong pending KWI");

        await farmingCenterInst.deposit(0, web3.utils.toBN("30").mul(tokenPrecision), {from: player2});
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(0, player0);
        assert.equal(pendingKWIPlayer0.toString(), "66666666666660000000", "wrong pending KWI");
        pendingKWIPlayer1 = await farmingCenterInst.pendingKWI(0, player1);
        assert.equal(pendingKWIPlayer1.toString(), "13333333333320000000", "wrong pending KWI");
        let pendingKWIPlayer2 = await farmingCenterInst.pendingKWI(0, player2);
        assert.equal(pendingKWIPlayer2.toString(), "0", "wrong pending KWI");

        let playerKWIBalancePreDeposit = await kwiInst.balanceOf(player0);
        await farmingCenterInst.deposit(0, "0", {from: player0});
        let playerKWIBalanceAfterDeposit = await kwiInst.balanceOf(player0);
        assert.equal("20999999999997000000", playerKWIBalanceAfterDeposit.sub(playerKWIBalancePreDeposit).toString(), "wrong kwi reward");

        let playerKWIBalancePreWithdraw = await kwiInst.balanceOf(player0);
        await farmingCenterInst.withdraw(0, "0", {from: player0});
        let playerKWIBalanceAfterWithdraw = await kwiInst.balanceOf(player0);
        assert.equal("999999999999000000", playerKWIBalanceAfterWithdraw.sub(playerKWIBalancePreWithdraw).toString(), "wrong kwi reward");

        const farmRewardLockInst = await FarmRewardLock.deployed();
        const farmRewardLockInfo = await farmRewardLockInst.userLockInfos(player0);
        assert.equal(farmRewardLockInfo.lockedAmount.toString(), "51333333333324000000","wrong lock amount");
        assert.equal(farmRewardLockInfo.unlockedAmount.toString(), "0", "wrong lock amount");
        assert.equal(farmRewardLockInfo.lastUpdateHeight.toString(), "0", "wrong lastUpdateHeight");
    });
    it('Test Deposit RHT', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        govGuardian = accounts[3];
        bcStakingTSS = accounts[4];
        player0 = accounts[5];
        player1 = accounts[6];
        player2 = accounts[7];
        player3 = accounts[8];
        player4 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();
        const lhtInst = await RHT.deployed();
        const kwiInst = await KWI.deployed();
        const farmingCenterInst = await FarmingCenter.deployed();
        const farmRewardLockInst = await FarmRewardLock.deployed();

        await lhtInst.mintTo(player0, web3.utils.toBN("50").mul(tokenPrecision), {from: initialGov});
        await lhtInst.mintTo(player1, web3.utils.toBN("50").mul(tokenPrecision), {from: initialGov});
        await lhtInst.mintTo(player2, web3.utils.toBN("50").mul(tokenPrecision), {from: initialGov});

        await lhtInst.approve(FarmingCenter.address, web3.utils.toBN("50").mul(tokenPrecision), {from: player0});
        await lhtInst.approve(FarmingCenter.address, web3.utils.toBN("50").mul(tokenPrecision), {from: player1});
        await lhtInst.approve(FarmingCenter.address, web3.utils.toBN("50").mul(tokenPrecision), {from: player2});

        await farmingCenterInst.add(1000, RHT.address, true, 50, 100, {from: initialGov});

        let pool0Info = await farmingCenterInst.poolInfo(0)
        assert.equal(pool0Info.allocPoint, "1000", "wrong allocPoint");
        let pool1Info = await farmingCenterInst.poolInfo(1)
        assert.equal(pool1Info.allocPoint, "1000", "wrong allocPoint");

        await farmingCenterInst.deposit(1, web3.utils.toBN("10").mul(tokenPrecision), {from: player0});
        let pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(1, player0);
        assert.equal(pendingKWIPlayer0, "0", "wrong pending KWI");

        await time.advanceBlock();
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(1, player0);
        assert.equal(pendingKWIPlayer0.toString(), "10000000000000000000", true, "wrong pending KWI");

        await farmingCenterInst.deposit(1, web3.utils.toBN("10").mul(tokenPrecision), {from: player1});
        await farmingCenterInst.deposit(1, web3.utils.toBN("20").mul(tokenPrecision), {from: player2});

        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(1, player0);
        assert.equal(pendingKWIPlayer0.toString(), web3.utils.toBN("250").mul(web3.utils.toBN(1e17)).toString(), "wrong pending KWI");

        await time.advanceBlock();
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(1, player0);
        assert.equal(pendingKWIPlayer0.toString(), web3.utils.toBN("2750").mul(web3.utils.toBN(1e16)).toString(), "wrong pending KWI");
        let pendingKWIPlayer1 = await farmingCenterInst.pendingKWI(1, player1);
        assert.equal(pendingKWIPlayer1.toString(), web3.utils.toBN("750").mul(web3.utils.toBN(1e16)).toString(), "wrong pending KWI");
        let pendingKWIPlayer2 = await farmingCenterInst.pendingKWI(1, player2);
        assert.equal(pendingKWIPlayer2.toString(), web3.utils.toBN("500").mul(web3.utils.toBN(1e16)).toString(), "wrong pending KWI");

        const sumOfThreePlayers = pendingKWIPlayer0.add(pendingKWIPlayer1).add(pendingKWIPlayer2);

        await farmingCenterInst.set(1, 9000, true, {from: initialGov});

        pool0Info = await farmingCenterInst.poolInfo(0)
        assert.equal(pool0Info.allocPoint, "2250", "wrong allocPoint");
        pool1Info = await farmingCenterInst.poolInfo(1)
        assert.equal(pool1Info.allocPoint, "9000", "wrong allocPoint");

        await time.advanceBlock();
        pendingKWIPlayer0 = await farmingCenterInst.pendingKWI(1, player0);
        pendingKWIPlayer1 = await farmingCenterInst.pendingKWI(1, player1);
        pendingKWIPlayer2 = await farmingCenterInst.pendingKWI(1, player2);

        assert.equal(pendingKWIPlayer0.add(pendingKWIPlayer1).add(pendingKWIPlayer2).sub(sumOfThreePlayers).toString(),
            "26000000000000000000", "wrong reward");

        await farmingCenterInst.setPoolRewardLockRate(1, 2, 10, {from: initialGov})

        const farmRewardLockInfoPre = await farmRewardLockInst.userLockInfos(player0);
        let playerKWIBalancePreDeposit = await kwiInst.balanceOf(player0);

        await farmingCenterInst.deposit(1, "0", {from: player0});

        const farmRewardLockInfoAfter = await farmRewardLockInst.userLockInfos(player0);
        let playerKWIBalanceAfterDeposit = await kwiInst.balanceOf(player0);
        assert.equal(farmRewardLockInfoAfter.lockedAmount.sub(farmRewardLockInfoPre.lockedAmount).mul(web3.utils.toBN(4)).toString(),
            playerKWIBalanceAfterDeposit.sub(playerKWIBalancePreDeposit).toString(), "wrong locked amount");
    });
    it('Test Reward Lock', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        govGuardian = accounts[3];
        bcStakingTSS = accounts[4];
        player0 = accounts[5];
        player1 = accounts[6];
        player2 = accounts[7];
        player3 = accounts[8];
        player4 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();
        const lhtInst = await RHT.deployed();
        const kwiInst = await KWI.deployed();
        const farmingCenterInst = await FarmingCenter.deployed();
        const farmRewardLockInst = await FarmRewardLock.deployed();

        await time.advanceBlockTo(123);

        let farmRewardLockInfo = await farmRewardLockInst.userLockInfos(player1);
        assert.equal(farmRewardLockInfo.lockedAmount.toString(), "0", "wrong lockedAmount");
        assert.equal(farmRewardLockInfo.unlockedAmount.toString(), "0", "wrong unlockedAmount");
        assert.equal(farmRewardLockInfo.lastUpdateHeight.toString(), "0", "wrong lastUpdateHeight");

        await farmingCenterInst.deposit(1, web3.utils.toBN("0"), {from: player1});

        farmRewardLockInfo = await farmRewardLockInst.userLockInfos(player1);
        assert.equal(farmRewardLockInfo.lockedAmount.toString(), "51600000000000000000", "wrong lockedAmount");
        assert.equal(farmRewardLockInfo.unlockedAmount.toString(), "0", "wrong unlockedAmount");

        await time.advanceBlockTo(133);

        await farmingCenterInst.deposit(1, web3.utils.toBN("0"), {from: player1});

        farmRewardLockInfo = await farmRewardLockInst.userLockInfos(player1);

        assert.equal(farmRewardLockInfo.lockedAmount.toString(), "53802247191011235956", "wrong lockedAmount");
        assert.equal(farmRewardLockInfo.unlockedAmount.toString(), "5797752808988764044", "wrong unlockedAmount");

        await time.advanceBlock();

        const farmRewardUnlockInfo = await farmRewardLockInst.unlockedAmount(player1);
        assert.equal(farmRewardUnlockInfo[0].toString(), "5797752808988764044", "wrong lockedAmount");
        assert.equal(farmRewardUnlockInfo[1].toString(), "681041103683686531", "wrong newUnlockedAmount");

        const beforeClaimPlayer1Balance = await kwiInst.balanceOf(player1);
        await farmRewardLockInst.claim({from: player1});
        const afterClaimPlayer1Balance = await kwiInst.balanceOf(player1);
        assert.equal(afterClaimPlayer1Balance.sub(beforeClaimPlayer1Balance).toString(),"7159835016356137106", "wrong claim amount");
    });
    it('Test Farming End', async () => {
        deployerAccount = accounts[0];
        initialGov = accounts[1];
        govGuardian = accounts[3];
        bcStakingTSS = accounts[4];
        player0 = accounts[5];
        player1 = accounts[6];
        player2 = accounts[7];
        player3 = accounts[8];
        player4 = accounts[9];

        const stakeHubInst = await StakeHub.deployed();
        const lhtInst = await RHT.deployed();
        const kwiInst = await KWI.deployed();
        const farmingCenterInst = await FarmingCenter.deployed();
        const farmRewardLockInst = await FarmRewardLock.deployed();

        await time.advanceBlockTo(farmingEndHeight.sub(web3.utils.toBN(20)));

        let playerKWIBalancePreHarvest = await kwiInst.balanceOf(player0);
        await farmingCenterInst.deposit(0, "0", {from: player0});
        let playerKWIBalancePostHarvest = await kwiInst.balanceOf(player0);
        assert.equal(playerKWIBalancePostHarvest.sub(playerKWIBalancePreHarvest).toString(),"141333333333330000000", "wrong harvest amount");

        await time.advanceBlockTo(farmingEndHeight);

        playerKWIBalancePreHarvest = await kwiInst.balanceOf(player0);
        await farmingCenterInst.deposit(0, "0", {from: player0});
        playerKWIBalancePostHarvest = await kwiInst.balanceOf(player0);
        assert.equal(playerKWIBalancePostHarvest.sub(playerKWIBalancePreHarvest).toString(),"12666666666660000000", "wrong harvest amount");

        await farmingCenterInst.deposit(0, "0", {from: player0});

        await time.advanceBlockTo(farmingEndHeight.add(web3.utils.toBN(40)));

        let player0UserInfo = await farmingCenterInst.userInfo(0, player0);
        let player1UserInfo = await farmingCenterInst.userInfo(0, player1);
        let player2UserInfo = await farmingCenterInst.userInfo(0, player2);
        await farmingCenterInst.withdraw(0, player0UserInfo[0], {from: player0});
        await farmingCenterInst.withdraw(0, player1UserInfo[0], {from: player1});
        await farmingCenterInst.withdraw(0, player2UserInfo[0], {from: player2});

        player0UserInfo = await farmingCenterInst.userInfo(1, player0);
        player1UserInfo = await farmingCenterInst.userInfo(1, player1);
        player2UserInfo = await farmingCenterInst.userInfo(1, player2);
        await farmingCenterInst.withdraw(1, player0UserInfo[0], {from: player0});
        await farmingCenterInst.withdraw(1, player1UserInfo[0], {from: player1});
        await farmingCenterInst.withdraw(1, player2UserInfo[0], {from: player2});

        await farmRewardLockInst.claim({from: player0});
        await farmRewardLockInst.claim({from: player1});

        let player0FinalKWIBalance = await kwiInst.balanceOf(player0);
        let player1FinalKWIBalance = await kwiInst.balanceOf(player1);
        let player2FinalKWIBalance = await kwiInst.balanceOf(player2);
        let govFinalKWIBalance = await kwiInst.balanceOf(initialGov);

        const totalMinedKWI = player0FinalKWIBalance
            .add(player1FinalKWIBalance)
            .add(player2FinalKWIBalance)
            .sub(player0InitialKWIBalance)
            .sub(player1InitialKWIBalance)
            .sub(player2InitialKWIBalance);
        assert.equal(totalMinedKWI.toString(), "3989999999999880000000", "wrong kwi change");
        assert.equal(govInitialKWIBalance.sub(govFinalKWIBalance).toString(), "4000000000000000000000", "wrong kwi change")

        await farmingCenterInst.deposit(0, web3.utils.toBN("0"), {from: player0});
        await farmingCenterInst.deposit(0, web3.utils.toBN("0"), {from: player1});
        await farmingCenterInst.deposit(0, web3.utils.toBN("0"), {from: player2});
        await farmingCenterInst.deposit(1, web3.utils.toBN("0"), {from: player0});
        await farmingCenterInst.deposit(1, web3.utils.toBN("0"), {from: player1});
        await farmingCenterInst.deposit(1, web3.utils.toBN("0"), {from: player2});

        player0FinalKWIBalance = await kwiInst.balanceOf(player0);
        player1FinalKWIBalance = await kwiInst.balanceOf(player1);
        player2FinalKWIBalance = await kwiInst.balanceOf(player2);

        const newTotalMinedKWI = player0FinalKWIBalance
            .add(player1FinalKWIBalance)
            .add(player2FinalKWIBalance)
            .sub(player0InitialKWIBalance)
            .sub(player1InitialKWIBalance)
            .sub(player2InitialKWIBalance)
        assert.equal(newTotalMinedKWI.toString(), totalMinedKWI.toString(), "wrong kwi total supply");

        let beforeEmergencyWithdrawAmountPlayer0 = await kwiInst.balanceOf(player0);
        let beforeEmergencyWithdrawAmountPlayer1 = await kwiInst.balanceOf(player1);
        let beforeEmergencyWithdrawAmountPlayer2 = await kwiInst.balanceOf(player2);

        await farmingCenterInst.emergencyWithdraw(0, {from: player0});
        await farmingCenterInst.emergencyWithdraw(0, {from: player1});
        await farmingCenterInst.emergencyWithdraw(0, {from: player2});

        let afterEmergencyWithdrawAmountPlayer0 = await kwiInst.balanceOf(player0);
        let afterEmergencyWithdrawAmountPlayer1 = await kwiInst.balanceOf(player1);
        let afterEmergencyWithdrawAmountPlayer2 = await kwiInst.balanceOf(player2);

        assert.equal(afterEmergencyWithdrawAmountPlayer0.sub(beforeEmergencyWithdrawAmountPlayer0).toString(), "0", "wrong kwi balance change");
        assert.equal(afterEmergencyWithdrawAmountPlayer1.sub(beforeEmergencyWithdrawAmountPlayer1).toString(), "0", "wrong kwi balance change");
        assert.equal(afterEmergencyWithdrawAmountPlayer2.sub(beforeEmergencyWithdrawAmountPlayer2).toString(), "0", "wrong kwi balance change");

        beforeEmergencyWithdrawAmountPlayer0 = await lhtInst.balanceOf(player0);
        beforeEmergencyWithdrawAmountPlayer1 = await lhtInst.balanceOf(player1);
        beforeEmergencyWithdrawAmountPlayer2 = await lhtInst.balanceOf(player2);

        await farmingCenterInst.emergencyWithdraw(1, {from: player0});
        await farmingCenterInst.emergencyWithdraw(1, {from: player1});
        await farmingCenterInst.emergencyWithdraw(1, {from: player2});

        afterEmergencyWithdrawAmountPlayer0 = await lhtInst.balanceOf(player0);
        afterEmergencyWithdrawAmountPlayer1 = await lhtInst.balanceOf(player1);
        afterEmergencyWithdrawAmountPlayer2 = await lhtInst.balanceOf(player2);

        assert.equal(afterEmergencyWithdrawAmountPlayer0.sub(beforeEmergencyWithdrawAmountPlayer0).toString(), "0", "wrong lht balance change");
        assert.equal(afterEmergencyWithdrawAmountPlayer1.sub(beforeEmergencyWithdrawAmountPlayer1).toString(), "0", "wrong lht balance change");
        assert.equal(afterEmergencyWithdrawAmountPlayer2.sub(beforeEmergencyWithdrawAmountPlayer2).toString(), "0", "wrong lht balance change");
    });
});