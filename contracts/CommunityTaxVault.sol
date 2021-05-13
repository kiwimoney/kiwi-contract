pragma solidity 0.6.12;

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

contract CommunityTaxVault is ReentrancyGuard {
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
}