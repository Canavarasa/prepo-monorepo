// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {SafeOwnable} from "./SafeOwnable.sol";
import {IWithdrawERC1155} from "./interfaces/IWithdrawERC1155.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract WithdrawERC1155 is IWithdrawERC1155, SafeOwnable, ReentrancyGuard {
  function withdrawERC1155(
    address[] calldata erc1155Tokens,
    address[] calldata recipients,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external override onlyOwner nonReentrant {
    require(
      erc1155Tokens.length == recipients.length &&
        recipients.length == ids.length &&
        ids.length == amounts.length,
      "Array length mismatch"
    );
    uint256 arrayLength = erc1155Tokens.length;
    for (uint256 i; i < arrayLength; ) {
      IERC1155(erc1155Tokens[i]).safeTransferFrom(
        address(this),
        recipients[i],
        ids[i],
        amounts[i],
        ""
      );
      unchecked {
        ++i;
      }
    }
  }

  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address,
    address,
    uint256[] memory,
    uint256[] memory,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC1155BatchReceived.selector;
  }
}
