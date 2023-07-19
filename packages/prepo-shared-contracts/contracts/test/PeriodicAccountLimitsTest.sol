// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../PeriodicAccountLimits.sol";

contract PeriodicAccountLimitsTest is PeriodicAccountLimits {
  function addAmount(address account, uint256 amount) external {
    _addAmount(account, amount);
  }
}
