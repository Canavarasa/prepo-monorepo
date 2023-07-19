// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IBlocklistTransferHook.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract BlocklistTransferHook is IBlocklistTransferHook, SafeOwnable {
  IAccountList private _blocklist;

  constructor() {}

  function hook(
    address from,
    address to,
    uint256 // _amount
  ) public virtual override {
    IAccountList list = _blocklist;
    require(!list.isIncluded(from), "Sender blocked");
    require(!list.isIncluded(to), "Recipient blocked");
  }

  function setBlocklist(IAccountList blocklist) external override onlyOwner {
    _blocklist = blocklist;
    emit BlocklistChange(blocklist);
  }

  function getBlocklist() external view override returns (IAccountList) {
    return _blocklist;
  }
}
