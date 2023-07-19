// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IPausable.sol";

contract Pausable is IPausable {
  bool private _paused;

  modifier whenNotPaused() {
    if (_paused) revert Paused();
    _;
  }

  constructor() {}

  function setPaused(bool paused) public virtual override {
    _paused = paused;
    emit PausedChange(paused);
  }

  function isPaused() external view override returns (bool) {
    return _paused;
  }
}
