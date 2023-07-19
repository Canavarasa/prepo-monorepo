// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {SafeOwnable} from "./SafeOwnable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

//TODO: add tests and interface for this
contract ERC1155Mintable is ERC1155, SafeOwnable {
  constructor(string memory uri) ERC1155(uri) {}

  function mint(
    address recipient,
    uint256 id,
    uint256 amount
  ) external onlyOwner {
    _mint(recipient, id, amount, "");
  }
}
