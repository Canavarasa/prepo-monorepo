// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/ITokenShop.sol";
import "./interfaces/IPurchaseHook.sol";
import "prepo-shared-contracts/contracts/Pausable.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";
import "prepo-shared-contracts/contracts/WithdrawERC721.sol";
import "prepo-shared-contracts/contracts/WithdrawERC1155.sol";

contract TokenShop is
  ITokenShop,
  Pausable,
  WithdrawERC20,
  WithdrawERC721,
  WithdrawERC1155
{
  using SafeERC20 for IERC20;

  IERC20 private _paymentToken;
  IPurchaseHook private _purchaseHook;
  mapping(address => mapping(uint256 => uint256)) private _contractToIdToPrice;
  mapping(address => mapping(address => uint256))
    private _userToERC721ToPurchaseCount;
  mapping(address => mapping(address => mapping(uint256 => uint256)))
    private _userToERC1155ToIdToPurchaseCount;

  constructor(address paymentToken) {
    _paymentToken = IERC20(paymentToken);
  }

  function setContractToIdToPrice(
    address[] memory tokenContracts,
    uint256[] memory ids,
    uint256[] memory prices
  ) external override onlyOwner {
    require(
      tokenContracts.length == prices.length && ids.length == prices.length,
      "Array length mismatch"
    );
    uint256 arrayLength = tokenContracts.length;
    for (uint256 i; i < arrayLength; ) {
      _contractToIdToPrice[tokenContracts[i]][ids[i]] = prices[i];
      unchecked {
        ++i;
      }
    }
  }

  function setPurchaseHook(address purchaseHook) external override onlyOwner {
    _purchaseHook = IPurchaseHook(purchaseHook);
  }

  function purchase(
    address[] memory tokenContracts,
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256[] memory purchasePrices
  ) external override nonReentrant whenNotPaused {
    require(
      tokenContracts.length == ids.length &&
        ids.length == amounts.length &&
        amounts.length == purchasePrices.length,
      "Array length mismatch"
    );
    IPurchaseHook hook = _purchaseHook;
    require(address(hook) != address(0), "Purchase hook not set");
    uint256 arrayLength = tokenContracts.length;
    for (uint256 i; i < arrayLength; ) {
      uint256 price = _contractToIdToPrice[tokenContracts[i]][ids[i]];
      require(price != 0, "Non-purchasable item");
      require(purchasePrices[i] >= price, "Purchase price < Price");
      uint256 totalPaymentAmount = price * amounts[i];
      _paymentToken.transferFrom(
        _msgSender(),
        address(this),
        totalPaymentAmount
      );
      bool isERC1155 = IERC1155(tokenContracts[i]).supportsInterface(
        type(IERC1155).interfaceId
      );
      if (isERC1155) {
        hook.hookERC1155(msg.sender, tokenContracts[i], ids[i], amounts[i]);
        _userToERC1155ToIdToPurchaseCount[msg.sender][tokenContracts[i]][
          ids[i]
        ] += amounts[i];
        IERC1155(tokenContracts[i]).safeTransferFrom(
          address(this),
          _msgSender(),
          ids[i],
          amounts[i],
          ""
        );
      } else {
        hook.hookERC721(msg.sender, tokenContracts[i], ids[i]);
        ++_userToERC721ToPurchaseCount[msg.sender][tokenContracts[i]];
        IERC721(tokenContracts[i]).safeTransferFrom(
          address(this),
          _msgSender(),
          ids[i]
        );
      }
      unchecked {
        ++i;
      }
    }
  }

  function getPrice(address tokenContract, uint256 id)
    external
    view
    override
    returns (uint256)
  {
    return _contractToIdToPrice[tokenContract][id];
  }

  function getPaymentToken() external view override returns (address) {
    return address(_paymentToken);
  }

  function getPurchaseHook() external view override returns (IPurchaseHook) {
    return _purchaseHook;
  }

  function getERC721PurchaseCount(address user, address tokenContract)
    external
    view
    override
    returns (uint256)
  {
    return _userToERC721ToPurchaseCount[user][tokenContract];
  }

  function getERC1155PurchaseCount(
    address user,
    address tokenContract,
    uint256 id
  ) external view override returns (uint256) {
    return _userToERC1155ToIdToPurchaseCount[user][tokenContract][id];
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC721Received.selector;
  }

  function withdrawERC20(
    address[] calldata erc20Tokens,
    uint256[] calldata amounts
  ) public override onlyOwner {
    super.withdrawERC20(erc20Tokens, amounts);
  }

  function withdrawERC20(address[] calldata erc20Tokens)
    public
    override
    onlyOwner
  {
    super.withdrawERC20(erc20Tokens);
  }
}
