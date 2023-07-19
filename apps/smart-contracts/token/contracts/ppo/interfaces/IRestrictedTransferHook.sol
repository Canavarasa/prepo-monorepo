// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IBlocklistTransferHook.sol";
import "prepo-shared-contracts/contracts/interfaces/IAccountList.sol";

/**
 * @notice Hook for restricting transfers of an ERC20 token.
 * @dev Transfers of the specified token are restricted by default.
 *
 * Any address can send to an allowlisted destination address.
 *
 * Allowlisted source addresses are able to send to any other address
 * (including addresses not on the destination allowlist).
 *
 * Blocklisted addresses cannot send or receive tokens, even if allowlisted.
 */
interface IRestrictedTransferHook is IBlocklistTransferHook {
  /**
   * @dev Emitted via `setSourceAllowlist()`.
   * @param allowlist Address of the `IAccountList` contract
   */
  event SourceAllowlistChange(IAccountList allowlist);

  /**
   * @dev Emitted via `setDestinationAllowlist()`.
   * @param allowlist Address of the `IAccountList` contract
   */
  event DestinationAllowlistChange(IAccountList allowlist);

  /**
   * @notice Sets the external `IAccountList` contract that specifies the
   * allowlisted source addresses.
   * @param sourceAllowlist Address of the `IAccountList` contract
   */
  function setSourceAllowlist(IAccountList sourceAllowlist) external;

  /**
   * @notice Sets the external `IAccountList` contract that specifies the
   * allowlisted destination addresses.
   * @param destinationAllowlist Address of the `IAccountList` contract
   */
  function setDestinationAllowlist(IAccountList destinationAllowlist) external;

  ///@return The source allowlist contract
  function getSourceAllowlist() external view returns (IAccountList);

  ///@return The destination allowlist contract
  function getDestinationAllowlist() external view returns (IAccountList);
}
