// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {IUintValue} from "./IUintValue.sol";

interface IFixedUintValue is IUintValue {
  event UintChange(uint256 value);

  function set(uint256 value) external;
}
