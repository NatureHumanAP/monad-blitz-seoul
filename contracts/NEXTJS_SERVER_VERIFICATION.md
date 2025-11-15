# Next.js 서버 환경에서 컨트랙트 로직 검증

## 📋 환경 설정

- **서버**: Next.js API Routes (서버리스 함수)
- **파일 저장**: 로컬 파일 시스템 (`storage/files/`)
- **메타데이터**: DB (PostgreSQL/MongoDB)
- **블록체인**: Monad 체인

---

## ✅ 검증 완료: 정상 동작하는 부분

### 1. 크레딧 충전 플로우 ✅

**클라이언트 → 컨트랙트 → 서버 이벤트 리스너 → DB**

```
1. 클라이언트: StorageCreditPool.deposit(amount) 호출
   ↓
2. 컨트랙트:
   - paymentToken.safeTransferFrom(msg.sender, address(this), amount)
   - creditBalance[msg.sender] += amount
   - emit CreditDeposited(msg.sender, amount)
   ↓
3. Next.js 서버 이벤트 리스너 (백그라운드 프로세스):
   - CreditDeposited 이벤트 감지
   - DB에서 walletAddress의 credit_balance 증가
   - 해당 지갑의 모든 파일의 is_prepaid_linked = TRUE 설정
```

**컨트랙트 코드 확인:**
- ✅ `deposit()` 함수: 정상 동작
- ✅ 이벤트 발생: `CreditDeposited(address indexed walletAddress, uint256 amount)`
- ✅ `msg.sender` 사용으로 지갑 주소 정확히 식별

**Next.js 서버에서 처리 가능:**
- ✅ 이벤트 리스너로 실시간 크레딧 충전 감지
- ✅ DB 업데이트로 오프체인 크레딧 관리

---

### 2. 크레딧 기반 다운로드 결제 ✅

**클라이언트 → Next.js API → DB 확인 → 로컬 파일 스트리밍**

```
1. 클라이언트: GET /api/download/{file_id}
   Headers: X-Wallet-Address: 0x..., X-Wallet-Signature: 0x...
   ↓
2. Next.js API Route:
   - 지갑 서명 검증 (EIP-712)
   - DB에서 walletAddress의 credit_balance 조회
   - 파일 크기로 transfer_fee 계산
   ↓
3. 크레딧 충분 시:
   - DB에서 credit_balance 즉시 차감 (오프체인)
   - 로컬 파일 시스템에서 파일 읽기: storage/files/{file_id[:2]}/{file_id}
   - 파일 스트리밍 시작 (200 OK)
```

**컨트랙트 사용:**
- ❌ **직접 사용 안 함** - 오프체인에서만 처리
- ✅ 온체인 동기화는 선택적: `deductCredit()` 호출 가능 (owner만)

**검증 결과:**
- ✅ 오프체인 크레딧 차감으로 빠른 처리
- ✅ 로컬 파일 시스템 접근 정상
- ⚠️ **주의**: 동시성 제어 필요 (트랜잭션 또는 락 사용)

---

### 3. x402 프로토콜 결제 (EIP-712 서명) ✅

**클라이언트 → 402 응답 → 서명 생성 → 재요청 → 컨트랙트 검증 → 파일 제공**

```
1. 클라이언트: GET /api/download/{file_id}
   ↓
2. Next.js API: 크레딧 부족 → 402 Payment Required
   Headers:
   - X-Payment-Required-Amount: 0.01
   - X-Payment-Address: {PaymentContract 주소}
   - X-Payment-Nonce: {고유 nonce}
   ↓
3. 클라이언트:
   a) USDC 토큰 approve
   b) EIP-712 서명 생성
   ↓
4. 클라이언트: 재요청
   GET /api/download/{file_id}
   Headers:
   - X-Payment-Signature: {signature}
   - X-Payment-Wallet-Address: {wallet}
   ↓
5. Next.js API:
   - PaymentContract.isNonceUsed(fileId, wallet, nonce) 호출 (view 함수)
   - EIP-712 서명 검증 (오프체인 또는 컨트랙트 호출)
   - PaymentContract.payWithSignature() 호출 (또는 서버에서 검증만)
   ↓
6. 성공 시:
   - 로컬 파일 시스템에서 파일 읽기
   - 파일 스트리밍 시작 (200 OK)
```

**컨트랙트 코드 확인:**
- ✅ `payWithSignature()`: EIP-712 서명 검증, nonce 중복 방지
- ✅ `isNonceUsed()`: view 함수로 빠른 확인
- ✅ 타임스탬프 검증 (5분~1시간)

**Next.js 서버에서 처리 가능:**
- ✅ view 함수 호출로 빠른 nonce 확인
- ✅ 서명 검증은 컨트랙트 또는 오프체인 모두 가능

---

### 4. 보관료 자동 차감 ✅

**스케줄러 → DB 조회 → 크레딧 차감 → 온체인 동기화 (선택)**

```
1. Next.js 스케줄러 (매일 자정, Vercel Cron 또는 별도 프로세스):
   - DB에서 is_prepaid_linked = TRUE인 모든 파일 조회
   ↓
2. 각 파일별:
   - daily_storage_fee = (file_size / 1GB) × $0.005 계산
   - uploader_wallet_address의 credit_balance 확인
   ↓
3. DB에서 credit_balance 차감 (오프체인)
   ↓
4. (선택) 온체인 동기화:
   - StorageCreditPool.deductCredit(walletAddress, amount, signature)
   - owner 권한으로 호출
```

**컨트랙트 코드 확인:**
- ✅ `deductCredit()`: owner만 호출 가능
- ✅ 잔액 부족 시 revert

**Next.js 서버에서 처리 가능:**
- ✅ 스케줄러 실행 (Vercel Cron 또는 별도 프로세스)
- ✅ DB 업데이트 후 온체인 동기화 선택적 수행

---

## ⚠️ 주의사항 및 개선 필요 부분

### 1. 동시성 제어 (Race Condition) ⚠️

**문제:**
```
사용자 A의 크레딧: $10
동시에 2개의 파일 다운로드 요청:
- 파일 1: $8 (크레딧 충분)
- 파일 2: $5 (크레딧 충분)

두 요청 모두 크레딧 충분으로 판단 → 총 $13 차감 시도 → 오류 발생
```

**해결 방안:**

**옵션 A: DB 트랜잭션 + 락**
```typescript
// Next.js API Route에서
await db.transaction(async (tx) => {
  // SELECT ... FOR UPDATE (행 잠금)
  const balance = await tx.wallets.findUnique({
    where: { walletAddress },
    select: { creditBalance: true }
  });
  
  if (balance.creditBalance >= transferFee) {
    await tx.wallets.update({
      where: { walletAddress },
      data: { creditBalance: { decrement: transferFee } }
    });
    // 파일 제공
  } else {
    // 402 응답
  }
});
```

**옵션 B: 분산 락 (Redis)**
```typescript
// 동시 요청 처리 시 Redis 락 사용
const lock = await redis.lock(`credit:${walletAddress}`, 5000);
try {
  // 크레딧 차감 로직
} finally {
  await lock.unlock();
}
```

**현재 컨트랙트:**
- ✅ 온체인 크레딧은 자동으로 동시성 보호 (Solidity의 원자성)
- ⚠️ 오프체인 DB 크레딧은 서버에서 처리 필요

---

### 2. 이벤트 리스너 안정성 ⚠️

**문제:**
- Next.js 서버리스 함수는 이벤트 리스너를 계속 실행하기 어려움
- 서버 재시작 시 이벤트 누락 가능

**해결 방안:**

**옵션 A: 별도 프로세스 실행**
```typescript
// listeners/contract-events.ts
// 별도 Node.js 프로세스로 실행 (PM2, Docker 등)
const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
const contract = new ethers.Contract(address, abi, provider);

contract.on("CreditDeposited", async (walletAddress, amount, event) => {
  // DB 업데이트
  await db.wallets.upsert({
    where: { walletAddress },
    update: { creditBalance: { increment: amount } },
    create: { walletAddress, creditBalance: amount }
  });
  
  // 파일 is_prepaid_linked 업데이트
  await db.files.updateMany({
    where: { uploaderWalletAddress: walletAddress },
    data: { isPrepaidLinked: true }
  });
});
```

**옵션 B: 폴링 방식**
```typescript
// 매 10초마다 최신 블록 체크
setInterval(async () => {
  const latestBlock = await provider.getBlockNumber();
  const events = await contract.queryFilter(
    contract.filters.CreditDeposited(),
    lastProcessedBlock + 1,
    latestBlock
  );
  
  for (const event of events) {
    // 이벤트 처리
  }
  
  lastProcessedBlock = latestBlock;
}, 10000);
```

**현재 컨트랙트:**
- ✅ 이벤트 발생 정상
- ⚠️ 서버 측 이벤트 리스너 구현 필요

---

### 3. 오프체인 vs 온체인 크레딧 동기화 ⚠️

**현재 구조:**
- 오프체인(DB): 빠른 크레딧 차감
- 온체인(컨트랙트): 크레딧 충전 및 동기화용

**문제:**
- 오프체인에서 차감 후 온체인 동기화를 하지 않으면 불일치 발생
- `deductCredit()`은 owner만 호출 가능 → 서버에서 호출 가능

**해결 방안:**

**전략 1: 주기적 동기화**
```typescript
// 매 시간마다 DB와 온체인 크레딧 동기화
// DB에서 차감된 총액 계산 → 한 번에 온체인에서 차감
```

**전략 2: 배치 동기화**
```typescript
// 크레딧 차감 시 DB에 기록만 하고,
// 배치로 주기적으로 온체인 동기화
```

**전략 3: 즉시 동기화 (느림)**
```typescript
// 크레딧 차감할 때마다 즉시 온체인 동기화
// 느리지만 정확함
```

**현재 컨트랙트:**
- ✅ `deductCredit()` 함수 존재
- ✅ owner 권한으로 서버에서 호출 가능
- ⚠️ 동기화 전략 선택 필요

---

### 4. 파일 경로 구조 확인 ✅

**로컬 파일 저장 구조:**
```
storage/files/
├── ab/
│   └── abc123def456...  # file_id의 첫 2글자
├── cd/
│   └── cde789fgh012...
```

**Next.js API Route에서 접근:**
```typescript
// app/api/download/[file_id]/route.ts
const filePath = path.join(
  process.cwd(),
  'storage',
  'files',
  fileId.slice(0, 2),
  fileId
);

const fileStream = fs.createReadStream(filePath);
return new Response(fileStream, {
  headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${fileName}"`
  }
});
```

**검증:**
- ✅ 로컬 파일 시스템 접근 정상
- ✅ 대용량 파일 스트리밍 가능

---

### 5. 스케줄러 실행 환경 ⚠️

**문제:**
- Next.js 서버리스 함수는 스케줄러를 직접 실행하기 어려움
- Vercel Cron은 제한적 (프리티어: 매일 1회)

**해결 방안:**

**옵션 A: Vercel Cron Jobs**
```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/storage-fee",
    "schedule": "0 0 * * *"  // 매일 자정
  }]
}

// app/api/cron/storage-fee/route.ts
export async function GET(request: Request) {
  // 보관료 차감 로직
}
```

**옵션 B: 별도 프로세스 (PM2, Docker)**
```typescript
// scheduler/storage-fee.ts
// 별도 Node.js 프로세스로 실행
setInterval(async () => {
  // 보관료 차감 로직
}, 24 * 60 * 60 * 1000); // 24시간
```

**옵션 C: 외부 스케줄러 (GitHub Actions, etc.)**
```yaml
# .github/workflows/storage-fee.yml
name: Storage Fee Deduction
on:
  schedule:
    - cron: '0 0 * * *'  # 매일 자정
jobs:
  deduct:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: curl -X POST https://your-api.com/api/cron/storage-fee
```

**검증:**
- ✅ 스케줄러 실행 방식 선택 필요
- ✅ 보관료 차감 로직은 정상 동작 가능

---

## 📊 최종 검증 결과

| 기능 | 컨트랙트 로직 | Next.js 통합 | 상태 |
|------|--------------|--------------|------|
| **크레딧 충전** | ✅ 정상 | ✅ 이벤트 리스너 필요 | ✅ |
| **크레딧 차감 (오프체인)** | ✅ 동기화 함수 있음 | ⚠️ 동시성 제어 필요 | ⚠️ |
| **x402 결제 (EIP-712)** | ✅ 정상 | ✅ view 함수 호출 가능 | ✅ |
| **파일 업로드** | ❌ 불필요 | ✅ 로컬 저장 정상 | ✅ |
| **파일 다운로드** | ❌ 불필요 | ✅ 로컬 파일 스트리밍 | ✅ |
| **보관료 차감** | ✅ 동기화 함수 있음 | ⚠️ 스케줄러 설정 필요 | ⚠️ |

---

## 🔧 권장 개선사항

### 1. 동시성 제어 추가 (필수)
```typescript
// services/payment.ts
import { Redis } from 'ioredis';

export async function deductCreditWithLock(
  walletAddress: string,
  amount: bigint
): Promise<boolean> {
  const lockKey = `credit:${walletAddress}`;
  const lock = await redis.acquireLock(lockKey, 5000); // 5초 타임아웃
  
  try {
    // 크레딧 차감 로직
    return await deductCredit(walletAddress, amount);
  } finally {
    await lock.release();
  }
}
```

### 2. 이벤트 리스너 안정화 (필수)
```typescript
// 별도 프로세스로 실행하거나 폴링 방식 사용
// 이벤트 누락 방지를 위한 블록 범위 체크
```

### 3. 오프체인-온체인 동기화 전략 수립 (권장)
```typescript
// 주기적 배치 동기화 또는 즉시 동기화 중 선택
// 크레딧 차감 이력 DB에 기록 후 배치로 처리
```

### 4. 스케줄러 실행 환경 구성 (필수)
```typescript
// Vercel Cron 또는 별도 프로세스 설정
```

---

## ✅ 결론

**컨트랙트 로직은 Next.js 서버 환경에서 정상 동작 가능합니다.**

다만 다음 사항들이 서버 측에서 구현되어야 합니다:
1. ✅ 동시성 제어 (DB 트랜잭션 또는 분산 락)
2. ✅ 이벤트 리스너 안정화 (별도 프로세스 또는 폴링)
3. ✅ 오프체인-온체인 크레딧 동기화 전략
4. ✅ 스케줄러 실행 환경 구성

**컨트랙트 자체는 변경할 필요 없습니다.** 현재 구조로 충분히 동작합니다.
