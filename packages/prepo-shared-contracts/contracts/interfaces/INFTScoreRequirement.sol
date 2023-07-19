// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface INFTScoreRequirement {
  event CollectionScoresChange(IERC721[] collections, uint256[] scores);
  event RequiredScoreChange(uint256 score);

  function setRequiredScore(uint256 requiredScore) external;

  function setCollectionScores(
    IERC721[] memory collections,
    uint256[] memory scores
  ) external;

  function removeCollections(IERC721[] memory collections) external;

  function getRequiredScore() external view returns (uint256);

  function getCollectionScore(IERC721 collection)
    external
    view
    returns (uint256);

  function getAccountScore(address account) external view returns (uint256);
}
