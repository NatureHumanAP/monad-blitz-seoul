// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StorageCreditPool
 * @notice 크레딧 풀 컨트랙트 - 사용자가 선불 크레딧을 충전하고 관리하는 컨트랙트
 * @dev M2M 자동 결제를 위한 크레딧 풀을 구축합니다.
 */
contract StorageCreditPool is Ownable {
    using SafeERC20 for IERC20;

    /// @notice 사용 가능한 결제 토큰 (예: USDC)
    IERC20 public paymentToken;

    /// @notice 지갑 주소별 크레딧 잔액
    mapping(address => uint256) public creditBalance;

    /// @notice 크레딧 충전 이벤트
    /// @param walletAddress 충전한 지갑 주소
    /// @param amount 충전된 금액 (토큰 단위)
    event CreditDeposited(address indexed walletAddress, uint256 amount);

    /// @notice 크레딧 인출 이벤트
    /// @param walletAddress 인출한 지갑 주소
    /// @param amount 인출된 금액 (토큰 단위)
    event CreditWithdrawn(address indexed walletAddress, uint256 amount);

    /// @notice 결제 토큰 설정 이벤트
    /// @param oldToken 이전 토큰 주소
    /// @param newToken 새 토큰 주소
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);

    /**
     * @param _paymentToken 결제에 사용할 ERC20 토큰 주소 (예: USDC)
     */
    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "StorageCreditPool: invalid payment token");
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice 크레딧 충전 - 사용자가 토큰을 전송하여 크레딧을 충전합니다.
     * @dev 전송된 토큰 금액만큼 크레딧 잔액을 증가시킵니다.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "StorageCreditPool: amount must be greater than 0");
        
        // 토큰 전송 (호출자가 approve 필요)
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // 크레딧 잔액 증가
        creditBalance[msg.sender] += amount;
        
        // 이벤트 발생
        emit CreditDeposited(msg.sender, amount);
    }

    /**
     * @notice 크레딧 인출 - 사용자가 충전한 크레딧을 인출합니다.
     * @param amount 인출할 금액
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "StorageCreditPool: amount must be greater than 0");
        require(creditBalance[msg.sender] >= amount, "StorageCreditPool: insufficient balance");
        
        // 크레딧 잔액 감소
        creditBalance[msg.sender] -= amount;
        
        // 토큰 반환
        paymentToken.safeTransfer(msg.sender, amount);
        
        // 이벤트 발생
        emit CreditWithdrawn(msg.sender, amount);
    }

    /**
     * @notice 서버에서 크레딧 차감 - 오프체인 크레딧 차감 시 사용
     * @dev 오프체인에서 잔액을 차감한 후, 이를 온체인에서 동기화하기 위한 함수
     * @param walletAddress 차감할 지갑 주소
     * @param amount 차감할 금액
     * @dev signature 파라미터는 향후 서명 검증 로직에서 사용 예정 (현재 미사용)
     */
    function deductCredit(address walletAddress, uint256 amount, bytes calldata /* signature */) external onlyOwner {
        require(walletAddress != address(0), "StorageCreditPool: invalid wallet address");
        require(amount > 0, "StorageCreditPool: amount must be greater than 0");
        require(creditBalance[walletAddress] >= amount, "StorageCreditPool: insufficient balance");
        
        // 크레딧 잔액 감소
        creditBalance[walletAddress] -= amount;
        
        // TODO: 서버 서명 검증 로직 추가 가능
        // 현재는 owner만 호출 가능하도록 설정
    }

    /**
     * @notice 결제 토큰 변경 (소유자만)
     * @param _newPaymentToken 새로운 결제 토큰 주소
     */
    function setPaymentToken(address _newPaymentToken) external onlyOwner {
        require(_newPaymentToken != address(0), "StorageCreditPool: invalid payment token");
        address oldToken = address(paymentToken);
        paymentToken = IERC20(_newPaymentToken);
        emit PaymentTokenUpdated(oldToken, _newPaymentToken);
    }

    /**
     * @notice 지갑 주소의 크레딧 잔액 조회
     * @param walletAddress 조회할 지갑 주소
     * @return 잔액 (토큰 단위)
     */
    function getBalance(address walletAddress) external view returns (uint256) {
        return creditBalance[walletAddress];
    }

    /**
     * @notice 컨트랙트에 잠긴 총 토큰 잔액 조회
     * @return 컨트랙트의 총 토큰 잔액
     */
    function getTotalLocked() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }
}

