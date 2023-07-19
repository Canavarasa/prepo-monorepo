// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../Vesting.sol";

contract MockVestingClaimer {
  Vesting private _vesting;

  constructor(address vesting) {
    _vesting = Vesting(vesting);
  }

  function claimFunds() external {
    _vesting.claim();
  }
}
