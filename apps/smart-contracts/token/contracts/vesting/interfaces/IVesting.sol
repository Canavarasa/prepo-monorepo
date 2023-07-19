// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

interface IVesting {
  event Allocation(address recipient, uint256 amount);

  event Claim(address recipient, uint256 amount);

  error InvalidStartTime();

  function setAllocations(
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external;

  function claim() external;

  function getToken() external view returns (address);

  function getVestingStartTime() external view returns (uint256);

  function getVestingEndTime() external view returns (uint256);

  function getAmountAllocated(address recipient)
    external
    view
    returns (uint256);

  function getTotalAllocatedSupply() external view returns (uint256);

  function getClaimedAmount(address recipient) external view returns (uint256);

  function getClaimableAmount(address recipient)
    external
    view
    returns (uint256);

  function getVestedAmount(address recipient) external view returns (uint256);
}
