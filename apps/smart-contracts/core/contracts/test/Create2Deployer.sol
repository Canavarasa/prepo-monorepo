// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

contract Create2Deployer {
  function deploy(bytes memory bytecode, bytes32 salt) external {
    address addr;
    assembly {
      /**
       * add(bytecode, 0x20) skips first 32 bytes since actual code starts
       * there. mload(bytecode) loads the first 32 bytes which contains the
       * size of the contract code.
       */
      addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
      if iszero(extcodesize(addr)) {
        revert(0, 0)
      }
    }
  }

  function transferOwnership(address ownableContract, address newOwner)
    external
  {
    (bool success, ) = ownableContract.call(
      abi.encodeWithSignature("transferOwnership(address)", newOwner)
    );
    require(success);
  }
}
