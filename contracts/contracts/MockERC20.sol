// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice 테스트용 Mock ERC20 토큰
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // 초기 발행량: 1,000,000 토큰
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    /**
     * @notice 테스트를 위한 토큰 민팅
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

