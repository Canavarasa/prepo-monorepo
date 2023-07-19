// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import {ILongShortToken} from "./interfaces/ILongShortToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20, ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract LongShortToken is
  ILongShortToken,
  ERC20Burnable,
  ERC20Permit,
  Ownable
{
  constructor(string memory name, string memory symbol)
    ERC20(name, symbol)
    ERC20Permit(name)
  {}

  function owner()
    public
    view
    override(Ownable, ILongShortToken)
    returns (address)
  {
    return super.owner();
  }

  function mint(address recipient, uint256 amount)
    external
    override
    onlyOwner
  {
    _mint(recipient, amount);
  }

  function burnFrom(address account, uint256 amount)
    public
    override(ERC20Burnable, ILongShortToken)
  {
    if (msg.sender == owner()) {
      super._burn(account, amount);
      return;
    }
    super.burnFrom(account, amount);
  }
}
