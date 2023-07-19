// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

interface IPausable {
  event PausedChange(bool newPaused);

  error Paused();

  function setPaused(bool newPaused) external;

  function isPaused() external view returns (bool);
}
