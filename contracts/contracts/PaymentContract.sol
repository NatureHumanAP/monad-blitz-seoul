// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title PaymentContract
 * @notice x402 프로토콜 결제 처리 컨트랙트
 * @dev 온체인 결제 및 EIP-712 서명 기반 결제를 처리합니다.
 */
contract PaymentContract {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice 결제 토큰 (예: USDC)
    IERC20 public paymentToken;

    /// @notice EIP-712 도메인 분리자
    bytes32 public DOMAIN_SEPARATOR;

    /// @notice EIP-712 타입 해시
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(string fileId,uint256 amount,uint256 nonce,uint256 timestamp)"
    );

    /// @notice 사용된 nonce 추적 (리플레이 공격 방지)
    mapping(bytes32 => bool) public usedNonces;

    /// @notice 결제 수신 이벤트
    /// @param payer 결제한 지갑 주소
    /// @param fileId 파일 ID
    /// @param amount 결제 금액
    /// @param nonce 사용된 nonce
    event PaymentReceived(
        address indexed payer,
        string fileId,
        uint256 amount,
        uint256 nonce
    );

    /// @notice 직접 토큰 전송 결제 이벤트
    /// @param payer 결제한 지갑 주소
    /// @param amount 결제 금액
    event DirectPayment(address indexed payer, uint256 amount);

    /**
     * @param _paymentToken 결제에 사용할 ERC20 토큰 주소 (예: USDC)
     */
    constructor(address _paymentToken) {
        require(_paymentToken != address(0), "PaymentContract: invalid payment token");
        paymentToken = IERC20(_paymentToken);

        // EIP-712 도메인 분리자 설정
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Nano Storage"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice EIP-712 서명 기반 결제 처리
     * @param fileId 파일 ID
     * @param amount 결제 금액
     * @param nonce 리플레이 공격 방지용 nonce
     * @param timestamp 타임스탬프
     * @param signature EIP-712 서명
     */
    function payWithSignature(
        string memory fileId,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        require(amount > 0, "PaymentContract: amount must be greater than 0");
        require(timestamp + 5 minutes >= block.timestamp, "PaymentContract: signature expired");
        require(timestamp <= block.timestamp + 1 hours, "PaymentContract: invalid timestamp");

        // nonce 생성 (fileId + wallet + nonce 조합)
        bytes32 nonceKey = keccak256(abi.encodePacked(fileId, msg.sender, nonce));
        require(!usedNonces[nonceKey], "PaymentContract: nonce already used");
        usedNonces[nonceKey] = true;

        // EIP-712 메시지 해시 생성
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_TYPEHASH,
                keccak256(bytes(fileId)),
                amount,
                nonce,
                timestamp
            )
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = hash.recover(signature);

        require(signer == msg.sender, "PaymentContract: invalid signature");
        require(signer != address(0), "PaymentContract: zero address signer");

        // 토큰 전송 (호출자가 approve 필요)
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // 이벤트 발생
        emit PaymentReceived(msg.sender, fileId, amount, nonce);
    }

    /**
     * @notice 직접 토큰 전송으로 결제
     * @param amount 결제 금액
     * @dev 단순히 토큰을 전송하여 결제하는 방식 (트랜잭션 해시로 검증)
     */
    function payDirect(uint256 amount) external {
        require(amount > 0, "PaymentContract: amount must be greater than 0");
        
        // 토큰 전송 (호출자가 approve 필요)
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // 이벤트 발생
        emit DirectPayment(msg.sender, amount);
    }

    /**
     * @notice 트랜잭션 해시로 결제 확인
     * @dev 클라이언트가 온체인 결제를 수행한 후, 트랜잭션 해시를 서버에 전달하여 검증
     * @dev 실제 구현은 오프체인에서 RPC를 통해 트랜잭션을 조회해야 함
     * @dev 이 함수는 항상 revert됩니다. 오프체인(서버)에서 트랜잭션을 검증해야 합니다.
     */
    function verifyPayment(bytes32 /* txHash */) external pure returns (address /* payer */, uint256 /* amount */) {
        // 실제 구현에서는 RPC를 통해 트랜잭션을 조회해야 합니다.
        // 컨트랙트에서는 직접 트랜잭션을 조회할 수 없으므로,
        // 이 함수는 오프체인(서버)에서 트랜잭션을 검증하는 로직으로 대체됩니다.
        revert("PaymentContract: use off-chain RPC verification");
    }

    /**
     * @notice nonce 사용 여부 확인
     * @param fileId 파일 ID
     * @param wallet 지갑 주소
     * @param nonce nonce 값
     * @return 사용 여부
     */
    function isNonceUsed(
        string memory fileId,
        address wallet,
        uint256 nonce
    ) external view returns (bool) {
        bytes32 nonceKey = keccak256(abi.encodePacked(fileId, wallet, nonce));
        return usedNonces[nonceKey];
    }

    /**
     * @notice EIP-712 메시지 해시 계산 (클라이언트 검증용)
     * @param fileId 파일 ID
     * @param amount 결제 금액
     * @param nonce nonce 값
     * @param timestamp 타임스탬프
     * @return 메시지 해시
     */
    function getPaymentHash(
        string memory fileId,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_TYPEHASH,
                keccak256(bytes(fileId)),
                amount,
                nonce,
                timestamp
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}

