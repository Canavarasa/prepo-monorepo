// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {ICollateral, IERC20} from "./interfaces/ICollateral.sol";
import {IHook} from "./interfaces/IHook.sol";
import {SafeAccessControlEnumerableUpgradeable} from "@prepo-shared-contracts/contracts/SafeAccessControlEnumerableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

contract Collateral is
  ICollateral,
  ERC20PermitUpgradeable,
  ReentrancyGuardUpgradeable,
  SafeAccessControlEnumerableUpgradeable
{
  IERC20 private immutable _baseToken;
  uint256 private immutable _baseTokenDenominator;
  uint256 private _depositFeePercent;
  uint256 private _withdrawFeePercent;
  IHook private _depositHook;
  IHook private _withdrawHook;

  uint256 public constant override PERCENT_UNIT = 1000000;
  uint256 public constant override FEE_LIMIT = 100000;
  bytes32 public constant override SET_DEPOSIT_FEE_PERCENT_ROLE =
    keccak256("setDepositFeePercent");
  bytes32 public constant override SET_WITHDRAW_FEE_PERCENT_ROLE =
    keccak256("setWithdrawFeePercent");
  bytes32 public constant override SET_DEPOSIT_HOOK_ROLE =
    keccak256("setDepositHook");
  bytes32 public constant override SET_WITHDRAW_HOOK_ROLE =
    keccak256("setWithdrawHook");

  constructor(IERC20 baseToken, uint256 baseTokenDecimals) {
    _baseToken = baseToken;
    _baseTokenDenominator = 10**baseTokenDecimals;
  }

  function initialize(string memory name, string memory symbol)
    public
    initializer
  {
    __SafeAccessControlEnumerable_init();
    __ERC20_init(name, symbol);
    __ERC20Permit_init(name);
    __ReentrancyGuard_init();
    _grantRole(SET_DEPOSIT_FEE_PERCENT_ROLE, msg.sender);
    _grantRole(SET_WITHDRAW_FEE_PERCENT_ROLE, msg.sender);
    _grantRole(SET_DEPOSIT_HOOK_ROLE, msg.sender);
    _grantRole(SET_WITHDRAW_HOOK_ROLE, msg.sender);
  }

  /**
   * @dev If hook not set, fees remain within the contract as extra reserves
   * (withdrawable by manager). Converts amount after fee from base token
   * units to collateral token units.
   */
  function deposit(
    address recipient,
    uint256 baseTokenAmount,
    bytes calldata data
  ) external override nonReentrant returns (uint256 collateralMintAmount) {
    _baseToken.transferFrom(msg.sender, address(this), baseTokenAmount);
    uint256 baseTokenFeeAmount = _processFee(
      baseTokenAmount,
      _depositFeePercent,
      _depositHook,
      recipient,
      data
    );
    uint256 baseTokenAmountAfterFee = baseTokenAmount - baseTokenFeeAmount;
    collateralMintAmount =
      (baseTokenAmountAfterFee * 1e18) /
      _baseTokenDenominator;
    _mint(recipient, collateralMintAmount);
    emit Deposit(
      msg.sender,
      recipient,
      baseTokenAmountAfterFee,
      baseTokenFeeAmount
    );
  }

  function withdraw(
    address recipient,
    uint256 collateralAmount,
    bytes calldata data
  ) external override nonReentrant returns (uint256 baseTokenAmountAfterFee) {
    uint256 baseTokenAmount = (collateralAmount * _baseTokenDenominator) /
      1e18;
    _burn(msg.sender, collateralAmount);
    uint256 baseTokenFeeAmount = _processFee(
      baseTokenAmount,
      _withdrawFeePercent,
      _withdrawHook,
      recipient,
      data
    );
    baseTokenAmountAfterFee = baseTokenAmount - baseTokenFeeAmount;
    _baseToken.transfer(recipient, baseTokenAmountAfterFee);
    emit Withdraw(
      msg.sender,
      recipient,
      baseTokenAmountAfterFee,
      baseTokenFeeAmount
    );
  }

  function setDepositFeePercent(uint256 depositFeePercent)
    external
    override
    onlyRole(SET_DEPOSIT_FEE_PERCENT_ROLE)
  {
    require(depositFeePercent <= FEE_LIMIT, "Exceeds fee limit");
    _depositFeePercent = depositFeePercent;
    emit DepositFeePercentChange(depositFeePercent);
  }

  function setWithdrawFeePercent(uint256 withdrawFeePercent)
    external
    override
    onlyRole(SET_WITHDRAW_FEE_PERCENT_ROLE)
  {
    require(withdrawFeePercent <= FEE_LIMIT, "Exceeds fee limit");
    _withdrawFeePercent = withdrawFeePercent;
    emit WithdrawFeePercentChange(withdrawFeePercent);
  }

  function setDepositHook(IHook depositHook)
    external
    override
    onlyRole(SET_DEPOSIT_HOOK_ROLE)
  {
    _depositHook = depositHook;
    emit DepositHookChange(address(depositHook));
  }

  function setWithdrawHook(IHook withdrawHook)
    external
    override
    onlyRole(SET_WITHDRAW_HOOK_ROLE)
  {
    _withdrawHook = withdrawHook;
    emit WithdrawHookChange(address(withdrawHook));
  }

  function getBaseToken() external view override returns (IERC20) {
    return _baseToken;
  }

  function getDepositFeePercent() external view override returns (uint256) {
    return _depositFeePercent;
  }

  function getWithdrawFeePercent() external view override returns (uint256) {
    return _withdrawFeePercent;
  }

  function getDepositHook() external view override returns (IHook) {
    return _depositHook;
  }

  function getWithdrawHook() external view override returns (IHook) {
    return _withdrawHook;
  }

  function getBaseTokenBalance() external view override returns (uint256) {
    return _baseToken.balanceOf(address(this));
  }

  function _processFee(
    uint256 baseTokenAmountBeforeFee,
    uint256 feePercent,
    IHook hook,
    address recipient,
    bytes calldata data
  ) internal returns (uint256 actualBaseTokenFeeAmount) {
    if (address(hook) == address(0)) return 0;
    if (feePercent == 0) {
      require(baseTokenAmountBeforeFee > 0, "base token amount = 0");
      hook.hook(
        msg.sender,
        recipient,
        baseTokenAmountBeforeFee,
        baseTokenAmountBeforeFee,
        data
      );
      return 0;
    }
    uint256 expectedBaseTokenFeeAmount = (baseTokenAmountBeforeFee *
      feePercent) / PERCENT_UNIT;
    require(expectedBaseTokenFeeAmount > 0, "fee = 0");
    _baseToken.approve(address(hook), expectedBaseTokenFeeAmount);
    uint256 baseTokenAllowanceBefore = _baseToken.allowance(
      address(this),
      address(hook)
    );
    hook.hook(
      msg.sender,
      recipient,
      baseTokenAmountBeforeFee,
      baseTokenAmountBeforeFee - expectedBaseTokenFeeAmount,
      data
    );
    actualBaseTokenFeeAmount =
      baseTokenAllowanceBefore -
      _baseToken.allowance(address(this), address(hook));
    _baseToken.approve(address(hook), 0);
  }
}
