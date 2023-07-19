// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {SafeOwnable} from "./SafeOwnable.sol";
import {IFixedUintValue} from "./interfaces/IFixedUintValue.sol";

contract FixedUintValue is IFixedUintValue, SafeOwnable {
  uint256 private _value;

  function set(uint256 value) external override onlyOwner {
    _value = value;
    emit UintChange(value);
  }

  function get() external view override returns (uint256) {
    return _value;
  }
}
