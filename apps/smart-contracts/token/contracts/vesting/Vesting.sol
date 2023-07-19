// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IVesting.sol";
import "prepo-shared-contracts/contracts/Pausable.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";

contract Vesting is IVesting, Pausable, SafeOwnable, WithdrawERC20 {
  IERC20 private immutable _token;
  uint256 private immutable _vestingStartTime;
  uint256 private immutable _vestingEndTime;

  mapping(address => uint256) private _recipientToAllocatedAmount;
  mapping(address => uint256) private _recipientToClaimedAmount;

  uint256 private _totalAllocatedSupply;

  constructor(
    address token,
    uint256 vestingStartTime,
    uint256 vestingEndTime
  ) {
    if (vestingStartTime >= vestingEndTime) revert();
    _token = IERC20(token);
    _vestingStartTime = vestingStartTime;
    _vestingEndTime = vestingEndTime;
  }

  function setAllocations(
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external override onlyOwner {
    require(recipients.length == amounts.length, "Array length mismatch");
    uint256 newTotalAllocatedSupply = _totalAllocatedSupply;
    uint256 arrayLength = recipients.length;
    for (uint256 i; i < arrayLength; ) {
      uint256 amount = amounts[i];
      address recipient = recipients[i];
      uint256 prevAllocatedAmount = _recipientToAllocatedAmount[recipient];
      /**
       * If the new allocation amount is greater than _prevAllocatedAmount,
       * the absolute difference is added to
       * _newTotalAllocatedSupply, otherwise it is subtracted.
       */
      if (amount > prevAllocatedAmount) {
        unchecked {
          newTotalAllocatedSupply += amount - prevAllocatedAmount;
        }
      } else {
        unchecked {
          newTotalAllocatedSupply -= prevAllocatedAmount - amount;
        }
      }
      _recipientToAllocatedAmount[recipient] = amount;
      emit Allocation(recipient, amount);
      unchecked {
        ++i;
      }
    }
    _totalAllocatedSupply = newTotalAllocatedSupply;
  }

  function claim() external override nonReentrant whenNotPaused {
    uint256 claimableAmount = getClaimableAmount(msg.sender);
    IERC20 vestedToken = _token;
    require(claimableAmount != 0, "Claimable amount = 0");
    require(
      vestedToken.balanceOf(address(this)) >= claimableAmount,
      "Insufficient balance in contract"
    );
    _recipientToClaimedAmount[msg.sender] += claimableAmount;
    vestedToken.transfer(msg.sender, claimableAmount);
    emit Claim(msg.sender, claimableAmount);
  }

  function getClaimableAmount(address recipient)
    public
    view
    override
    returns (uint256)
  {
    uint256 vestedAmount = getVestedAmount(recipient);
    uint256 claimedTillNow = _recipientToClaimedAmount[recipient];
    if (vestedAmount > claimedTillNow) {
      return (vestedAmount - claimedTillNow);
    } else {
      return 0;
    }
  }

  function getVestedAmount(address recipient)
    public
    view
    override
    returns (uint256)
  {
    uint256 start = _vestingStartTime;
    uint256 end = _vestingEndTime;
    uint256 allocated = _recipientToAllocatedAmount[recipient];
    if (block.timestamp < start) return 0;
    uint256 _vested = (allocated * (block.timestamp - start)) / (end - start);
    return _vested < allocated ? _vested : allocated;
  }

  function getToken() external view override returns (address) {
    return address(_token);
  }

  function getVestingStartTime() external view override returns (uint256) {
    return _vestingStartTime;
  }

  function getVestingEndTime() external view override returns (uint256) {
    return _vestingEndTime;
  }

  function getAmountAllocated(address recipient)
    external
    view
    override
    returns (uint256)
  {
    return _recipientToAllocatedAmount[recipient];
  }

  function getTotalAllocatedSupply() external view override returns (uint256) {
    return _totalAllocatedSupply;
  }

  function getClaimedAmount(address recipient)
    external
    view
    override
    returns (uint256)
  {
    return _recipientToClaimedAmount[recipient];
  }

  function setPaused(bool paused) public override onlyOwner {
    super.setPaused(paused);
  }

  function withdrawERC20(
    address[] calldata erc20Tokens,
    uint256[] calldata amounts
  ) public override onlyOwner {
    super.withdrawERC20(erc20Tokens, amounts);
  }

  function withdrawERC20(address[] calldata erc20Tokens)
    public
    override
    onlyOwner
  {
    super.withdrawERC20(erc20Tokens);
  }
}
