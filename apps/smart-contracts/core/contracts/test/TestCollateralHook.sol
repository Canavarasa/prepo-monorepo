// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../interfaces/IHook.sol";
import "../interfaces/ICollateral.sol";

/// @notice this contract is a test contract made to test a use case where a Deposit/Withdraw hook only takes a part of the fee
contract TestCollateralHook is IHook {
  address public treasury;
  uint256 public portionToTake;
  uint256 public constant PERCENT_UNIT = 1000000;

  constructor(address _treasury, uint256 _portionToTake) {
    treasury = _treasury;
    portionToTake = _portionToTake;
  }

  function hook(
    address,
    address recipient,
    uint256 amountBeforeFee,
    uint256 amountAfterFee,
    bytes calldata
  ) external virtual override {
    uint256 fee = ((amountBeforeFee - amountAfterFee) * portionToTake) /
      PERCENT_UNIT;
    ICollateral(msg.sender).getBaseToken().transferFrom(
      msg.sender,
      treasury,
      fee
    );
  }
}
