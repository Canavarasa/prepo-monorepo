// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IMiniSalesFlag.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract MiniSalesFlag is IMiniSalesFlag, SafeOwnable {
  bool private _saleStarted;

  function setSaleStarted(bool saleStarted) external override onlyOwner {
    _saleStarted = saleStarted;
  }

  function hasSaleStarted() external view override returns (bool) {
    return _saleStarted;
  }
}
