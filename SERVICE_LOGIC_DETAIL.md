# Nano Storage 서비스 상세 로직 명세서

## 프로젝트 개요

**[x402 프로토콜](https://www.notion.so/monad-foundation/How-to-get-started-with-x402-on-Monad-2ac6367594f281fbb8a6d47d9ddb073d)**과 스마트 컨트랙트를 결합한 하이브리드 종량제(Pay-as-you-Go) 클라우드 스토리지 서비스입니다. API 키 및 로그인 없이, Monad 체인 기반 온체인 결제 또는 오프체인 크레딧을 통해 데이터 접근의 자유를 제공합니다.

**x402 프로토콜**은 HTTP 402 Payment Required 상태 코드를 활용한 블록체인 기반 마이크로 결제 프로토콜로, Monad 체인 상에서 실시간 결제 검증 및 서명 기반 인증을 지원합니다.

---

## 1. 💰 최종 요금 체제 (Pricing Structure)

모든 요금은 마이크로 결제에 최적화된 스테이블코인 (예: $USDC) 기반으로 책정됩니다.

| 구분 | 단위 | 요금 | 부과 방식 | 결제 모델 |
|------|------|------|-----------|-----------|
| **보관료** (Storage Fee) | 1 GB당 | $0.005 / 일 | 일 단위로 정기 차감 | 선불 크레딧 전용 |
| **다운로드** (Transfer Fee) | 1 GB당 | $0.01 / 다운로드 | 요청당 실시간 결제 | x402 또는 크레딧 차감 |
| **업로드** (Upload Fee) | - | **$0.00** | 무료 (진입 장벽 최소화) | 모든 모델 |
| **최소 결제 단위** | - | $0.0001 | - | x402 마이크로 결제 |

### 📌 핵심 원칙

- **Subscription-Free**: 모든 결제는 API 키/로그인 없이 지갑 주소 기반으로 이루어집니다.
- **Hybrid Approach**: 사용자의 요구(즉시성 vs. 효율성)에 따라 결제 경로를 선택적으로 제공합니다.

---

## 2. ⚙️ 핵심 서비스 로직 상세 설계

### 2.1. 파일 업로드 로직 (POST /upload)

**목적**: 사용자의 지갑 주소(Wallet ID)를 기록하고 무료 보관 기간을 설정하여 진입 장벽을 낮춥니다.

- **인증**: 불필요 (무료 서비스)
- **DB 기록 항목**:
  - `file_id` (SHA-256)
  - `file_size` (Bytes)
  - `uploader_wallet_id`
  - `upload_date`
  - `expiration_date` (30일 후)
  - `is_prepaid_linked` (FALSE로 초기 설정)
- **응답**: 다운로드 URL 및 보관료 안내 정보 제공
  ```json
  {
    "fileId": "...",
    "downloadUrl": "/download/{file_id}",
    "storageInfo": {
      "hasPrepaidStorage": false,
      "estimatedDeletionDate": "YYYY-MM-DD",  // upload_date + 30일
      "daysUntilDeletion": 30,
      "message": "30일 무료 보관 제공. 장기 보관을 원하시면 크레딧을 충전하여 보관료를 활성화해주세요.",
      "dailyStorageFee": 0.0005,  // 파일 크기 기반 계산
      "monthlyStorageFee": 0.015
    }
  }
  ```
- **사용자 안내**:
  - 보관료 없는 유저 (`is_prepaid_linked = FALSE`): 예상 삭제일(`expiration_date`) 표시
  - 보관료 활성화 안내: "보관료는 일정 금액을 충전해두면 자동으로 차감됩니다."

### 2.2. 다운로드 결제 로직 (GET /download/:file_id)

이 로직은 크레딧 잔액 확인을 먼저 시도하고, 부족하면 x402 결제로 전환하는 하이브리드 결제 시스템의 핵심입니다.

#### 단계별 처리 흐름

1. **인증 & 헤더 확인**
   - 요청 헤더에서 `X-Wallet-Signature` 및 `X-Wallet-Id`를 확인
   - 크레딧 모델 사용 시: 지갑 서명(`X-Wallet-Signature`) 검증 필수
   - x402 결제 모델 사용 시: `X-Payment-Signature` 및 `X-Payment-Wallet-Id` 포함 여부 확인

2. **요금 계산**
   - 파일 크기를 확인하고 다운로드 요금(`transfer_fee`) 계산

3. **크레딧 잔액 확인 (선불 모델 우선)**
   - DB에서 `x-wallet-id`의 `credit_balance` 조회
   - **잔액 충분 시**: 지갑 서명이 유효하면 잔액을 즉시 차감 (오프체인)하고 4단계로 이동
   - **잔액 부족 시**: 5단계 (x402 결제)로 전환

4. **성공**: 파일 스트리밍 시작 및 응답 코드 `200 OK`

5. **x402 결제 전환 (Fallback)**
   - HTTP 응답 코드 `402 Payment Required` 반환
   - 응답 헤더에 다음 정보 포함:
     - `X-Payment-Required-Amount: [transfer_fee]` - 결제 필요 금액
     - `X-Payment-Address: [payment_contract_address]` - Monad 체인 상 결제 컨트랙트 주소
     - `X-Payment-Token: [token_address]` - 결제 토큰 주소 (예: USDC)
     - `X-Payment-Nonce: [nonce]` - 리플레이 공격 방지를 위한 nonce 값
   - 클라이언트는 다음 중 하나의 방식으로 결제 처리:
     - **온체인 결제**: Monad 체인 상에서 결제 컨트랙트로 직접 토큰 전송
     - **서명 기반 결제**: 결제 메시지(`file_id`, `amount`, `nonce`, `timestamp`)에 대한 EIP-712 서명을 생성하여 헤더에 포함
   - x402 재요청 처리:
     - 재요청 시 헤더에 `X-Payment-Signature` 및 `X-Payment-Wallet-Id` 포함
     - 서버는 Monad 체인 상의 트랜잭션 확인 또는 EIP-712 서명 검증 수행
     - 검증 성공 시 파일 스트리밍 시작 및 `200 OK` 응답

### 2.3. 선불 크레딧 충전 로직 (POST /deposit)

이 과정은 스마트 컨트랙트를 통해 M2M 자동 결제를 위한 크레딧 풀을 구축합니다.

1. **온체인 트랜잭션 수신**
   - 사용자가 스마트 컨트랙트 `StorageCreditPool`에 스테이블코인 전송(`deposit`)

2. **서버 이벤트 리스닝**
   - 서버는 컨트랙트의 `CreditDeposited(wallet_id, amount)` 이벤트를 리스닝하여 충전 내역 확인

3. **DB 잔액 업데이트**
   - `wallet_id`를 키로 하여 DB의 `credit_balance`를 `amount`만큼 증가시킴
   - 크레딧 잔액은 오프체인에서 관리

4. **보관료 활성화**
   - 해당 Wallet ID와 연결된 모든 파일의 `is_prepaid_linked` 플래그를 **TRUE**로 설정하여 보관료 자동 차감 대상에 포함
   - 기존 파일들의 `expiration_date` 제한 해제 (크레딧이 있으면 계속 보관 가능)

### 2.4. 파일 상태 및 사용자 안내

#### 파일 상태별 UI 안내

**보관료 없는 파일 (`is_prepaid_linked = FALSE`):**
```
📁 파일명: document.pdf (100 MB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 예상 삭제일: 2024-02-15 (25일 후)
💡 장기 보관을 원하시나요?
   크레딧을 충전하여 보관료를 활성화하세요
   → 일일 보관료: $0.0005 | 월: $0.015
   [크레딧 충전하기]
```

**보관료 있는 파일 (`is_prepaid_linked = TRUE`):**
```
📁 파일명: document.pdf (100 MB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 보관료 활성화됨
💰 일일 보관료: $0.0005
📊 월 보관료: $0.015
💳 현재 크레딧: $10
⏱️ 보관 가능 기간: 약 20,000일
```

**보관료 부족 경고:**
```
⚠️ 보관료 잔액 부족 경고
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
현재 크레딧: $0.01
예상 일일 보관료: $0.003
⏰ 보관 가능 기간: 약 3일

3일 후 파일들이 자동으로 잠금됩니다.
계속 보관하려면 크레딧을 충전해주세요.
[충전하기]
```

#### API 응답 예시

**파일 목록 조회 (GET /api/files?walletAddress=0x...):**
```json
{
  "files": [
    {
      "fileId": "...",
      "fileName": "document.pdf",
      "fileSize": 104857600,
      "uploadDate": "2024-01-10T00:00:00Z",
      "expirationDate": "2024-02-10T00:00:00Z",
      "isPrepaidLinked": false,
      "storageStatus": "free_storage",
      "estimatedDeletionDate": "2024-02-10",
      "daysUntilDeletion": 25,
      "dailyStorageFee": 0.0005,
      "monthlyStorageFee": 0.015
    },
    {
      "fileId": "...",
      "isPrepaidLinked": true,
      "storageStatus": "prepaid_storage",
      "creditBalance": 10,
      "dailyStorageFee": 0.0005,
      "daysCovered": 20000
    }
  ]
}
```

**예상 보관료 조회 (GET /api/storage-fee/estimate?walletAddress=0x...):**
```json
{
  "walletAddress": "0x...",
  "creditBalance": 0,
  "files": [
    {
      "fileId": "...",
      "fileName": "document.pdf",
      "fileSize": 104857600,
      "dailyStorageFee": 0.0005,
      "monthlyStorageFee": 0.015,
      "expirationDate": "2024-02-10",
      "daysUntilExpiration": 25
    }
  ],
  "summary": {
    "totalDailyFee": 0.0005,
    "totalMonthlyFee": 0.015,
    "daysCovered": 0,
    "needsDeposit": true,
    "message": "보관료는 일정 금액을 충전해두면 자동으로 차감됩니다."
  }
}
```

### 2.5. 보관료 자동 차감 로직 (스케줄러)

서버에서 매일 자정에 실행되는 독립된 로직으로, M2M 환경에서 보관료를 자동 차감하고 서비스 지속성을 확보합니다.

#### 스케줄러 처리 흐름

1. **대상 조회**
   - DB에서 `is_prepaid_linked`가 **TRUE**인 모든 파일 레코드를 조회
   - 보관료 없는 파일(`is_prepaid_linked = FALSE`)은 `expiration_date` 기준으로 삭제 처리

2. **일일 보관료 계산 및 차감** (보관료 활성화 파일만)
   - 파일 크기 기반으로 일일 보관료(`daily_storage_fee`) 계산
   - 해당 파일의 `uploader_wallet_id`에 맵핑된 `credit_balance`에서 `daily_storage_fee`를 자동 차감

3. **잔액 고갈 및 경고**
   - 잔액이 3일치 예상 보관료 미만으로 떨어지면 Wallet ID에 "잔액 부족 경고" 알림 발송
   - 잔액이 **$0**이 되면: 해당 Wallet ID와 연결된 모든 파일에 대해 **`download_locked` 플래그를 TRUE**로 설정
   - 잠금 후 7일 유예 기간이 지나도 충전이 없으면 파일을 자동 삭제 처리

4. **만료된 파일 삭제** (보관료 없는 파일)
   - `is_prepaid_linked = FALSE`이고 `expiration_date`가 지난 파일 삭제
   - 파일 시스템에서도 물리적으로 삭제

---

## 3. 🔐 x402 프로토콜 통합 상세

### 3.1. x402 결제 흐름

x402 프로토콜은 Monad 체인 기반 마이크로 결제를 위한 표준화된 HTTP 프로토콜입니다.

#### 결제 요청 처리

1. **클라이언트 요청**
   ```
   GET /download/{file_id}
   Headers:
     X-Wallet-Id: 0x...
   ```

2. **서버 응답 (402 Payment Required)**
   ```
   HTTP/1.1 402 Payment Required
   X-Payment-Required-Amount: 0.01
   X-Payment-Address: 0x[payment_contract]
   X-Payment-Token: 0x[usdc_address]
   X-Payment-Nonce: [unique_nonce]
   X-Payment-Chain-Id: 41500  // Monad 테스트넷 또는 메인넷 ID
   ```

3. **클라이언트 결제 처리 (두 가지 방식)**

   **방식 A: 온체인 직접 결제**
   - Monad 체인 상 결제 컨트랙트에 토큰 전송
   - 트랜잭션 해시를 헤더에 포함하여 재요청

   **방식 B: 서명 기반 결제 (EIP-712)**
   ```javascript
   // EIP-712 구조화된 데이터 서명
   const domain = {
     name: "Nano Storage",
     version: "1",
     chainId: 41500,
     verifyingContract: paymentContractAddress
   };
   
   const message = {
     fileId: file_id,
     amount: transfer_fee,
     nonce: nonce,
     timestamp: timestamp
   };
   
   const signature = await wallet.signTypedData(domain, { Payment: types }, message);
   ```

4. **재요청 및 검증**
   ```
   GET /download/{file_id}
   Headers:
     X-Payment-Signature: 0x[signature]
     X-Payment-Wallet-Id: 0x[wallet]
     X-Payment-Tx-Hash: 0x[tx_hash]  // 온체인 결제 시
   ```

5. **서버 검증**
   - **온체인 결제**: Monad RPC를 통해 트랜잭션 확인
   - **서명 기반**: EIP-712 서명 검증 및 nonce 중복 사용 체크
   - 검증 성공 시 파일 제공 (`200 OK`)

### 3.2. 보안 고려사항

- **Nonce 관리**: 각 결제 요청마다 고유한 nonce 생성 및 재사용 방지
- **타임스탬프 검증**: 서명 메시지에 타임스탬프 포함 및 유효 기간 확인 (예: 5분)
- **Replay 공격 방지**: nonce + 타임스탬프 조합으로 리플레이 공격 방어
- **체인 ID 검증**: EIP-712 서명 시 체인 ID 검증으로 멀티체인 공격 방지

---

## 4. 🛡️ 보안 및 인증 전략 (API Key Free)

| 항목 | 기존 방식 (API Key) | Nano Storage 방식 (x402 + Wallet ID/Signature) |
|------|---------------------|------------------------------------------------|
| **식별자** | 임의로 생성된 문자열 | 고유한 지갑 주소 (Wallet ID) - Monad 체인 주소 |
| **인증 수단** | HTTP 헤더에 키 포함 | EIP-712 또는 메시지 서명 기반 인증 (지갑 소유 증명) |
| **결제 방식** | API 키 기반 권한 부여 | **x402 프로토콜**: HTTP 402 + 온체인 결제 또는 서명 기반 검증 |
| **결제 검증** | 서버 DB 확인 | Monad 체인 상 트랜잭션 확인 또는 EIP-712 서명 검증 |
| **M2M 자동 결제** | 프라이빗 키를 서버에 저장하여 요청마다 서명 | 선불 충전된 크레딧 잔액 풀에서 고속 차감 (더 안전하고 효율적) |
| **마이크로 결제** | 부적합 (최소 금액 제한) | x402 프로토콜로 최소 단위($0.0001)까지 지원 |

---

## 5. 📋 파일 관리 및 사용자 안내

### 5.1. 파일 상태

| 상태 | 설명 | 조건 |
|------|------|------|
| `free_storage` | 무료 보관 (30일) | `is_prepaid_linked = FALSE` |
| `prepaid_storage` | 보관료 활성화됨 | `is_prepaid_linked = TRUE`, 크레딧 잔액 > 0 |
| `locked` | 다운로드 잠금 | 크레딧 잔액 = 0, 7일 유예 기간 중 |
| `expired` | 만료됨 | `expiration_date` 도달 또는 유예 기간 종료 |

### 5.2. 사용자 안내 메시지

**보관료 없는 유저:**
- "30일 무료 보관이 제공됩니다. 장기 보관을 원하시면 크레딧을 충전하여 보관료를 활성화해주세요."
- "예상 삭제일: YYYY-MM-DD (X일 후)"
- "보관료는 일정 금액을 충전해두면 자동으로 차감됩니다."

**보관료 있는 유저:**
- "보관료가 활성화되어 크레딧으로 자동 차감됩니다."
- "크레딧 잔액이 부족해지면 파일이 잠금됩니다."
- "3일치 미만이면 경고 알림을 드립니다."

### 5.3. 보관료 계산 공식

```typescript
// 일일 보관료 계산
dailyStorageFee = (fileSizeInGB) × $0.005

// 월 보관료 계산
monthlyStorageFee = dailyStorageFee × 30

// 보관 가능 기간 계산
daysCovered = creditBalance / totalDailyFee
```

