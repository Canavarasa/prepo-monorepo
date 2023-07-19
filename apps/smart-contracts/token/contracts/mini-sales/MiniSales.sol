// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IMiniSales.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";

contract MiniSales is IMiniSales, SafeOwnable, WithdrawERC20 {
  IERC20 private immutable _saleToken;
  IERC20 private immutable _paymentToken;
  uint256 private immutable _saleTokenDenominator;
  uint256 private _price;
  IPurchaseHook private _purchaseHook;

  constructor(
    address saleToken,
    address paymentToken,
    uint256 saleTokenDecimals
  ) {
    _saleToken = IERC20(saleToken);
    _paymentToken = IERC20(paymentToken);
    _saleTokenDenominator = 10**saleTokenDecimals;
  }

  function purchase(
    address recipient,
    uint256 saleTokenAmount,
    uint256 purchasePrice,
    bytes calldata _data
  ) external override nonReentrant {
    require(purchasePrice == _price, "Price mismatch");
    if (address(_purchaseHook) != address(0)) {
      _purchaseHook.hook(
        _msgSender(),
        recipient,
        saleTokenAmount,
        purchasePrice,
        _data
      );
    }
    uint256 paymentTokenAmount = (saleTokenAmount * purchasePrice) /
      _saleTokenDenominator;
    _paymentToken.transferFrom(
      _msgSender(),
      address(this),
      paymentTokenAmount
    );
    _saleToken.transfer(recipient, saleTokenAmount);
    emit Purchase(_msgSender(), recipient, saleTokenAmount, purchasePrice);
  }

  function setPrice(uint256 price) external override onlyOwner {
    _price = price;
    emit PriceChange(price);
  }

  function setPurchaseHook(IPurchaseHook purchaseHook)
    external
    override
    onlyOwner
  {
    _purchaseHook = purchaseHook;
    emit PurchaseHookChange(purchaseHook);
  }

  function getSaleToken() external view override returns (IERC20) {
    return _saleToken;
  }

  function getPaymentToken() external view override returns (IERC20) {
    return _paymentToken;
  }

  function getPrice() external view override returns (uint256) {
    return _price;
  }

  function getPurchaseHook() external view override returns (IPurchaseHook) {
    return _purchaseHook;
  }

  function getSaleForPayment(uint256 payment)
    external
    view
    override
    returns (uint256)
  {
    return (payment * _saleTokenDenominator) / _price;
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
