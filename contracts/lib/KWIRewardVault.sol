pragma solidity 0.6.12;

import "../lib/Ownable.sol";

import "openzeppelin-solidity/contracts/GSN/Context.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

contract KWIRewardVault is Ownable {
    IERC20 public kwi;

    constructor(
        IERC20 _kwi,
        address _owner
    ) public {
        kwi = _kwi;
        super.initializeOwner(_owner);
    }

    function safeTransferKWI(address recipient, uint256 amount) onlyOwner external returns (uint256){
        uint256 balance = kwi.balanceOf(address(this));
        if (balance>=amount) {
            kwi.transfer(recipient, amount);
            return amount;
        } else {
            kwi.transfer(recipient, balance);
            return balance;
        }
    }
}