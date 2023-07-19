// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IPurchaseHook.sol";
import "./interfaces/ITokenShop.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract PurchaseHook is IPurchaseHook, SafeOwnable {
  mapping(address => uint256) private _erc721ToMaxPurchasesPerUser;
  mapping(address => mapping(uint256 => uint256))
    private _erc1155ToIdToMaxPurchasesPerUser;
  ITokenShop private _tokenShop;

  //TODO: EOA validation check in hookERC721 and hookERC1155 implementation
  function hookERC721(
    address user,
    address tokenContract,
    uint256 // tokenId
  ) external view override {
    ITokenShop shop = _tokenShop;
    require(address(shop) != address(0), "Token shop not set in hook");
    uint256 maxPurchaseAmount = _erc721ToMaxPurchasesPerUser[tokenContract];
    if (maxPurchaseAmount != 0) {
      require(
        shop.getERC721PurchaseCount(user, tokenContract) < maxPurchaseAmount,
        "ERC721 purchase limit reached"
      );
    }
  }

  function hookERC1155(
    address user,
    address tokenContract,
    uint256 tokenId,
    uint256 amount
  ) external view override {
    ITokenShop shop = _tokenShop;
    require(address(shop) != address(0), "Token shop not set in hook");
    uint256 maxPurchaseAmount = _erc1155ToIdToMaxPurchasesPerUser[
      tokenContract
    ][tokenId];
    if (maxPurchaseAmount != 0) {
      require(
        shop.getERC1155PurchaseCount(user, tokenContract, tokenId) + amount <=
          maxPurchaseAmount,
        "ERC1155 purchase limit reached"
      );
    }
  }

  function setTokenShop(address tokenShop) external override onlyOwner {
    _tokenShop = ITokenShop(tokenShop);
  }

  function setMaxERC721PurchasesPerUser(
    address[] memory contracts,
    uint256[] memory amounts
  ) external override onlyOwner {
    require(contracts.length == amounts.length, "Array length mismatch");
    uint256 arrayLength = contracts.length;
    for (uint256 i; i < arrayLength; ) {
      _erc721ToMaxPurchasesPerUser[contracts[i]] = amounts[i];
      unchecked {
        ++i;
      }
    }
  }

  function setMaxERC1155PurchasesPerUser(
    address[] memory contracts,
    uint256[] memory ids,
    uint256[] memory amounts
  ) external override onlyOwner {
    require(
      contracts.length == amounts.length && ids.length == amounts.length,
      "Array length mismatch"
    );
    uint256 arrayLength = contracts.length;
    for (uint256 i; i < arrayLength; ) {
      _erc1155ToIdToMaxPurchasesPerUser[contracts[i]][ids[i]] = amounts[i];
      unchecked {
        ++i;
      }
    }
  }

  function getMaxERC721PurchasesPerUser(address tokenContract)
    external
    view
    override
    returns (uint256)
  {
    return _erc721ToMaxPurchasesPerUser[tokenContract];
  }

  function getMaxERC1155PurchasesPerUser(address tokenContract, uint256 id)
    external
    view
    override
    returns (uint256)
  {
    return _erc1155ToIdToMaxPurchasesPerUser[tokenContract][id];
  }

  function getTokenShop() external view override returns (ITokenShop) {
    return _tokenShop;
  }
}
