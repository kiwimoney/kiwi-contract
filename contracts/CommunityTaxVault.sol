pragma solidity 0.6.12;

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract CommunityTaxVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public governor;

    event Deposit(address from, uint256 amount);
    event Withdraw(address tokenAddr, address recipient, uint256 amount);
    event GovernorshipTransferred(address oldGovernor, address newGovernor);

    constructor(
        address _govAddr
    ) public {
        governor = _govAddr;
    }

    receive () external payable {
        emit Deposit(msg.sender, msg.value);
    }

    modifier onlyGov() {
        require(msg.sender == governor, "only governance is allowed");
        _;
    }

    function transferGovernorship(address newGovernor) onlyGov external {
        require(newGovernor != address(0), "new governor is zero address");
        emit GovernorshipTransferred(governor, newGovernor);
        governor = newGovernor;
    }

    function claim(uint256 amount, address payable recipient) nonReentrant onlyGov external returns(uint256) {
        if (address(this).balance < amount) {
            amount = address(this).balance;
        }
        recipient.transfer(amount);
        emit Withdraw(address(0x0), recipient, amount);
        return amount;
    }

    function claimHRC20(address hec20, uint256 amount, address payable recipient) nonReentrant onlyGov external returns(uint256) {
        uint256 balance = IERC20(hec20).balanceOf(address(this));
        if ( balance < amount) {
            amount = balance;
        }
        IERC20(hec20).safeTransfer(recipient, amount);
        emit Withdraw(hec20, recipient, amount);
        return amount;
    }
}