// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {SafeOwnable} from "./SafeOwnable.sol";
import {IWithdrawERC721} from "./interfaces/IWithdrawERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract WithdrawERC721 is IWithdrawERC721, SafeOwnable, ReentrancyGuard {
  function withdrawERC721(
    address[] calldata erc721Tokens,
    address[] calldata recipients,
    uint256[] calldata ids
  ) external override onlyOwner nonReentrant {
    require(erc721Tokens.length == ids.length, "Array length mismatch");
    uint256 arrayLength = erc721Tokens.length;
    for (uint256 i; i < arrayLength; ) {
      IERC721(erc721Tokens[i]).transferFrom(
        address(this),
        recipients[i],
        ids[i]
      );
      unchecked {
        ++i;
      }
    }
  }
}
