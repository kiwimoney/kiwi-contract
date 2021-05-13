pragma solidity 0.6.12;

import "../lib/KWIRewardVault.sol";
import "../lib/Ownable.sol";
import "../interface/IFarmRewardLock.sol";

contract FarmingCenter is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accKWIPerShare;
        uint256 molecularOfLockRate;
        uint256 denominatorOfLockRate;
    }

    uint256 constant public REWARD_CALCULATE_PRECISION = 1e12;

    bool public initialized;

    IERC20 public kwi;
    KWIRewardVault public kwiRewardVault;
    IFarmRewardLock public farmRewardLock;
    
    uint256 public kwiPerBlock;
    uint256 public totalAllocPoint;
    uint256 public startBlock;
    uint256 public endBlock;

    PoolInfo[] public poolInfo;
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, uint256 reward, uint256 lockedReward);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, uint256 reward, uint256 lockedReward);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor() public {}

    function initialize(
        address _owner,
        IERC20 _kwi,
        IFarmRewardLock _farmRewardLock,
        uint256 _molecularOfLockRate,
        uint256 _denominatorOfLockRate
    ) public
    {
        require(!initialized, "already initialized");
        initialized = true;

        kwiRewardVault = new KWIRewardVault(_kwi, address(this));

        super.initializeOwner(_owner);
        farmRewardLock = _farmRewardLock;
        kwi = _kwi;
        kwiPerBlock = 0;
        startBlock = 0;
        endBlock = 0;

        poolInfo.push(PoolInfo({
            lpToken: IERC20(address(_kwi)),
            allocPoint: 1000,
            lastRewardBlock: startBlock,
            accKWIPerShare: 0,
            molecularOfLockRate: _molecularOfLockRate,
            denominatorOfLockRate: _denominatorOfLockRate
        }));
        totalAllocPoint = 1000;
    }

    function addNewFarmingPeriod(uint256 farmingPeriod, uint256 startHeight, uint256 kwiRewardPerBlock) public onlyOwner {
        require(block.number > endBlock, "Previous farming is not completed yet");
        require(block.number <= startHeight, "Start height must be in the future");
        require(kwiRewardPerBlock > 0, "kwiRewardPerBlock must be larger than 0");
        require(farmingPeriod > 0, "farmingPeriod must be larger than 0");
        
        massUpdatePools();

        uint256 totalKWIAmount = farmingPeriod.mul(kwiRewardPerBlock);
        kwi.safeTransferFrom(msg.sender, address(kwiRewardVault), totalKWIAmount);

        kwiPerBlock = kwiRewardPerBlock;
        startBlock = startHeight;
        endBlock = startHeight.add(farmingPeriod);

        for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
            PoolInfo storage pool = poolInfo[pid];
            pool.lastRewardBlock = startHeight;
        }
    }

    function increaseFarmingReward(uint256 increasedKWIRewardPerBlock) public onlyOwner {
        require(block.number < endBlock, "Previous farming is already completed");
        massUpdatePools();

        uint256 kwiAmount = increasedKWIRewardPerBlock.mul(endBlock.sub(block.number));
        kwi.safeTransferFrom(msg.sender, address(kwiRewardVault), kwiAmount);
        kwiPerBlock = kwiPerBlock.add(increasedKWIRewardPerBlock);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate, uint256 molecularOfLockRate, uint256 denominatorOfLockRate) public onlyOwner {
        require(denominatorOfLockRate>0&&denominatorOfLockRate>=molecularOfLockRate, "invalid denominatorOfLockRate or molecularOfLockRate");
        for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
            PoolInfo memory pool = poolInfo[pid];
            require(pool.lpToken!=_lpToken, "duplicated pool");
        }
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accKWIPerShare: 0,
            molecularOfLockRate: molecularOfLockRate,
            denominatorOfLockRate: denominatorOfLockRate
            }));
        updateKWIPool();
    }

    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        require(_pid < poolInfo.length, "invalid pool id");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            updateKWIPool();
        }
    }

    function updateKWIPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        // ensure the first pool weight is no less than 20%
        points = points.div(4);
        if (points != 0 && points > poolInfo[0].allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(points);
            poolInfo[0].allocPoint = points;
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= endBlock) {
            return _to.sub(_from);
        } else if (_from >= endBlock) {
            return 0;
        } else {
            return endBlock.sub(_from);
        }
    }

    function pendingKWI(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accKWIPerShare = pool.accKWIPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 kwiReward = multiplier.mul(kwiPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accKWIPerShare = accKWIPerShare.add(kwiReward.mul(REWARD_CALCULATE_PRECISION).div(lpSupply));
        }
        return user.amount.mul(accKWIPerShare).div(REWARD_CALCULATE_PRECISION).sub(user.rewardDebt);
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePool(uint256 _pid) public {
        require(_pid < poolInfo.length, "invalid pool id");
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 kwiReward = multiplier.mul(kwiPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accKWIPerShare = pool.accKWIPerShare.add(kwiReward.mul(REWARD_CALCULATE_PRECISION).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount) public {
        require(_pid < poolInfo.length, "invalid pool id");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        uint256 reward;
        uint256 lockedReward;
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accKWIPerShare).div(REWARD_CALCULATE_PRECISION).sub(user.rewardDebt);

            if (pending > 0) {
                (reward, lockedReward) = rewardKWI(msg.sender, pending, pool.molecularOfLockRate, pool.denominatorOfLockRate);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accKWIPerShare).div(REWARD_CALCULATE_PRECISION);
        emit Deposit(msg.sender, _pid, _amount, reward, lockedReward);
    }

    function withdraw(uint256 _pid, uint256 _amount) public {
        require(_pid < poolInfo.length, "invalid pool id");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 reward;
        uint256 lockedReward;
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accKWIPerShare).div(REWARD_CALCULATE_PRECISION).sub(user.rewardDebt);

        if (pending > 0) {
            (reward, lockedReward) = rewardKWI(msg.sender, pending, pool.molecularOfLockRate, pool.denominatorOfLockRate);
        }

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accKWIPerShare).div(REWARD_CALCULATE_PRECISION);
        emit Withdraw(msg.sender, _pid, _amount, reward, lockedReward);
    }

    function emergencyWithdraw(uint256 _pid) public {
        require(_pid < poolInfo.length, "invalid pool id");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    function rewardKWI(address _to, uint256 _amount, uint256 molecularOfLockRate, uint256 denominatorOfLockRate) internal returns (uint256, uint256) {
        uint256 farmingReward = _amount;
        uint256 lockedAmount = 0;
        if (block.number < farmRewardLock.getLockEndHeight()) {
            lockedAmount = farmingReward.mul(molecularOfLockRate).div(denominatorOfLockRate);
            farmingReward = farmingReward.sub(lockedAmount);
            uint256 actualAmount = kwiRewardVault.safeTransferKWI(address(farmRewardLock), lockedAmount);
            farmRewardLock.notifyDeposit(_to, actualAmount);
        }
        uint256 actualAmount = kwiRewardVault.safeTransferKWI(_to, farmingReward);
        return (actualAmount, lockedAmount);
    }

    function setPoolRewardLockRate(uint256 _pid, uint256 molecular, uint256 denominator) public onlyOwner {
        require(denominator>0&&denominator>=molecular, "invalid molecular or denominator");
        PoolInfo storage pool = poolInfo[_pid];
        pool.molecularOfLockRate = molecular;
        pool.denominatorOfLockRate = denominator;
    }
}
