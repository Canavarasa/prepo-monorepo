// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IAllowlistPurchaseHook.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract AllowlistPurchaseHook is IAllowlistPurchaseHook, SafeOwnable {
  IAccountList private _allowlist;

  constructor() {}

  function hook(
    address, // _purchaser
    address recipient,
    uint256, // _amount
    uint256, // _price
    bytes calldata // _data
  ) public virtual override {
    require(_allowlist.isIncluded(recipient), "Recipient not allowed");
  }

  function setAllowlist(IAccountList allowlist) external override onlyOwner {
    _allowlist = allowlist;
    emit AllowlistChange(allowlist);
  }

  function getAllowlist() external view override returns (IAccountList) {
    return _allowlist;
  }
}
