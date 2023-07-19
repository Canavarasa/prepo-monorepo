// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IRestrictedTransferHook.sol";
import "./BlocklistTransferHook.sol";

contract RestrictedTransferHook is
  IRestrictedTransferHook,
  BlocklistTransferHook
{
  IAccountList private _sourceAllowlist;
  IAccountList private _destinationAllowlist;

  constructor() {}

  function hook(
    address from,
    address to,
    uint256 amount
  ) public virtual override(BlocklistTransferHook, ITransferHook) {
    super.hook(from, to, amount);
    if (_sourceAllowlist.isIncluded(from)) return;
    require(_destinationAllowlist.isIncluded(to), "Destination not allowed");
  }

  function setSourceAllowlist(IAccountList sourceAllowlist)
    external
    override
    onlyOwner
  {
    _sourceAllowlist = sourceAllowlist;
    emit SourceAllowlistChange(sourceAllowlist);
  }

  function setDestinationAllowlist(IAccountList destinationAllowlist)
    external
    override
    onlyOwner
  {
    _destinationAllowlist = destinationAllowlist;
    emit DestinationAllowlistChange(destinationAllowlist);
  }

  function getSourceAllowlist() external view override returns (IAccountList) {
    return _sourceAllowlist;
  }

  function getDestinationAllowlist()
    external
    view
    override
    returns (IAccountList)
  {
    return _destinationAllowlist;
  }
}
