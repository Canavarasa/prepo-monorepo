// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721Mintable is IERC721 {
  function mint(address recipient, uint256 tokenId) external;
}
