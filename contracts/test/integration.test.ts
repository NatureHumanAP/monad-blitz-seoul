import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

// Typechain types will be generated after compilation
type StorageCreditPool = any;
type PaymentContract = any;
type MockERC20 = any;

describe("통합 테스트 (Integration Tests)", function () {
    let storageCreditPool: StorageCreditPool;
    let paymentContract: PaymentContract;
    let mockERC20: MockERC20;
    let owner: any;
    let user: any;
    const { ethers } = hre as any;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const CREDIT_AMOUNT = ethers.parseEther("1000"); // 크레딧 충전량
    const STORAGE_FEE = ethers.parseEther("0.005"); // 일일 보관료 (1GB 기준)
    const TRANSFER_FEE = ethers.parseEther("0.01"); // 다운로드 요금 (1GB 기준)

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        // MockERC20 배포
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20Factory.deploy("Test Token", "TEST");

        // StorageCreditPool 배포
        const StorageCreditPoolFactory = await ethers.getContractFactory("StorageCreditPool");
        storageCreditPool = await StorageCreditPoolFactory.deploy(await mockERC20.getAddress());

        // PaymentContract 배포
        const PaymentContractFactory = await ethers.getContractFactory("PaymentContract");
        paymentContract = await PaymentContractFactory.deploy(await mockERC20.getAddress());

        // 테스트를 위해 user에게 토큰 전송
        await mockERC20.transfer(user.address, INITIAL_SUPPLY / 10n);
    });

    describe("시나리오 1: 크레딧 충전 -> 크레딧 기반 다운로드 결제", function () {
        it("✅ 전체 플로우가 정상적으로 작동해야 함", async function () {
            // 1. 사용자가 크레딧 충전
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), CREDIT_AMOUNT);
            await expect(storageCreditPool.connect(user).deposit(CREDIT_AMOUNT))
                .to.emit(storageCreditPool, "CreditDeposited")
                .withArgs(user.address, CREDIT_AMOUNT);

            expect(await storageCreditPool.getBalance(user.address)).to.equal(CREDIT_AMOUNT);

            // 2. 서버에서 크레딧 차감 (다운로드 요금)
            const emptySignature = "0x";
            await storageCreditPool.connect(owner).deductCredit(user.address, TRANSFER_FEE, emptySignature);

            // 3. 잔액 확인
            const expectedBalance = CREDIT_AMOUNT - TRANSFER_FEE;
            expect(await storageCreditPool.getBalance(user.address)).to.equal(expectedBalance);
            expect(await storageCreditPool.getTotalLocked()).to.equal(CREDIT_AMOUNT);
        });

        it("✅ 여러 번 다운로드 시나리오가 작동해야 함", async function () {
            // 1. 크레딧 충전
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), CREDIT_AMOUNT);
            await storageCreditPool.connect(user).deposit(CREDIT_AMOUNT);

            // 2. 여러 번 다운로드 (크레딧 차감)
            const downloadCount = 5;
            const emptySignature = "0x";

            for (let i = 0; i < downloadCount; i++) {
                await storageCreditPool.connect(owner).deductCredit(user.address, TRANSFER_FEE, emptySignature);
            }

            // 3. 최종 잔액 확인
            const expectedBalance = CREDIT_AMOUNT - TRANSFER_FEE * BigInt(downloadCount);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(expectedBalance);
        });

        it("❌ 크레딧 부족 시 다운로드 실패해야 함", async function () {
            // 1. 작은 양의 크레딧만 충전
            const smallCredit = ethers.parseEther("1");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), smallCredit);
            await storageCreditPool.connect(user).deposit(smallCredit);

            // 2. 잔액보다 큰 요금 차감 시도 (실패해야 함)
            const largeFee = ethers.parseEther("10");
            const emptySignature = "0x";

            await expect(
                storageCreditPool.connect(owner).deductCredit(user.address, largeFee, emptySignature),
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");
        });
    });

    describe("시나리오 2: x402 프로토콜 - EIP-712 서명 기반 결제", function () {
        it("✅ 전체 x402 결제 플로우가 작동해야 함", async function () {
            const fileId = "file-12345";
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const paymentAmount = TRANSFER_FEE;

            // 1. 사용자가 approve
            await mockERC20.connect(user).approve(await paymentContract.getAddress(), paymentAmount);

            // 2. EIP-712 서명 생성
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: paymentAmount,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await user.signTypedData(domain, types, message);

            // 3. 서명 기반 결제
            const userBalanceBefore = await mockERC20.balanceOf(user.address);
            const contractBalanceBefore = await mockERC20.balanceOf(await paymentContract.getAddress());

            await expect(
                paymentContract.connect(user).payWithSignature(fileId, paymentAmount, nonce, timestamp, signature),
            )
                .to.emit(paymentContract, "PaymentReceived")
                .withArgs(user.address, fileId, paymentAmount, nonce);

            // 4. 잔액 확인
            expect(await mockERC20.balanceOf(user.address)).to.equal(userBalanceBefore - paymentAmount);
            expect(await mockERC20.balanceOf(await paymentContract.getAddress())).to.equal(contractBalanceBefore + paymentAmount);
            expect(await paymentContract.isNonceUsed(fileId, user.address, nonce)).to.be.true;
        });

        it("✅ 여러 파일에 대한 결제가 각각 작동해야 함", async function () {
            const fileIds = ["file-1", "file-2", "file-3"];
            const paymentAmount = TRANSFER_FEE;

            await mockERC20.connect(user).approve(await paymentContract.getAddress(), paymentAmount * BigInt(fileIds.length));

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            for (let i = 0; i < fileIds.length; i++) {
                const timestamp = Math.floor(Date.now() / 1000) + i;
                const message = {
                    fileId: fileIds[i],
                    amount: paymentAmount,
                    nonce: i + 1,
                    timestamp: timestamp,
                };

                const signature = await user.signTypedData(domain, types, message);
                await paymentContract.connect(user).payWithSignature(fileIds[i], paymentAmount, i + 1, timestamp, signature);

                expect(await paymentContract.isNonceUsed(fileIds[i], user.address, i + 1)).to.be.true;
            }
        });

        it("❌ 리플레이 공격이 방지되어야 함", async function () {
            const fileId = "file-replay-test";
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);
            const paymentAmount = TRANSFER_FEE;

            await mockERC20.connect(user).approve(await paymentContract.getAddress(), paymentAmount * 2n);

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: paymentAmount,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await user.signTypedData(domain, types, message);

            // 첫 번째 결제 성공
            await paymentContract.connect(user).payWithSignature(fileId, paymentAmount, nonce, timestamp, signature);

            // 같은 서명으로 재시도 (실패해야 함)
            await expect(
                paymentContract.connect(user).payWithSignature(fileId, paymentAmount, nonce, timestamp, signature),
            ).to.be.revertedWith("PaymentContract: nonce already used");
        });
    });

    describe("시나리오 3: 하이브리드 결제 시스템", function () {
        it("✅ 크레딧 충전 후 x402 결제로 전환 가능해야 함", async function () {
            // 1. 크레딧 충전
            const creditAmount = ethers.parseEther("100");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount);
            await storageCreditPool.connect(user).deposit(creditAmount);

            // 2. 크레딧으로 일부 결제
            const transferFee1 = ethers.parseEther("10");
            const emptySignature = "0x";
            await storageCreditPool.connect(owner).deductCredit(user.address, transferFee1, emptySignature);

            // 3. 크레딧 부족 상황 시뮬레이션 - x402로 전환
            const transferFee2 = ethers.parseEther("200"); // 크레딧보다 큰 금액
            const remainingCredit = creditAmount - transferFee1;

            // 크레딧 차감 시도 (실패해야 함)
            await expect(
                storageCreditPool.connect(owner).deductCredit(user.address, transferFee2, emptySignature),
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");

            // x402 결제로 전환
            const fileId = "file-x402";
            const nonce = 1;
            // 블록체인 시간 사용 (컨트랙트 검증 시간과 일치)
            const blockNumber = await ethers.provider.getBlockNumber();
            const block = await ethers.provider.getBlock(blockNumber);
            const timestamp = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

            await mockERC20.connect(user).approve(await paymentContract.getAddress(), transferFee2);

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: transferFee2,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await user.signTypedData(domain, types, message);

            // x402 결제 성공
            await expect(
                paymentContract.connect(user).payWithSignature(fileId, transferFee2, nonce, timestamp, signature),
            )
                .to.emit(paymentContract, "PaymentReceived")
                .withArgs(user.address, fileId, transferFee2, nonce);

            // 크레딧 잔액은 그대로 유지
            expect(await storageCreditPool.getBalance(user.address)).to.equal(remainingCredit);
        });

        it("✅ 크레딧 충전 -> 크레딧 사용 -> 크레딧 추가 충전 플로우", async function () {
            // 1. 첫 번째 크레딧 충전
            const creditAmount1 = ethers.parseEther("100");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount1 * 2n);
            await storageCreditPool.connect(user).deposit(creditAmount1);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(creditAmount1);

            // 2. 크레딧 사용
            const usage1 = ethers.parseEther("30");
            const emptySignature = "0x";
            await storageCreditPool.connect(owner).deductCredit(user.address, usage1, emptySignature);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(creditAmount1 - usage1);

            // 3. 추가 크레딧 충전
            const creditAmount2 = ethers.parseEther("50");
            await storageCreditPool.connect(user).deposit(creditAmount2);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(creditAmount1 - usage1 + creditAmount2);

            // 4. 다시 사용
            const usage2 = ethers.parseEther("20");
            await storageCreditPool.connect(owner).deductCredit(user.address, usage2, emptySignature);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(creditAmount1 - usage1 + creditAmount2 - usage2);
        });
    });

    describe("시나리오 4: 보관료 자동 차감 시뮬레이션", function () {
        it("✅ 여러 날의 보관료가 정확히 차감되어야 함", async function () {
            // 1. 크레딧 충전
            const creditAmount = ethers.parseEther("1000");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount);
            await storageCreditPool.connect(user).deposit(creditAmount);

            // 2. 여러 날의 보관료 차감 시뮬레이션
            const dailyStorageFee = STORAGE_FEE;
            const days = 10;
            const emptySignature = "0x";

            for (let day = 1; day <= days; day++) {
                await storageCreditPool.connect(owner).deductCredit(user.address, dailyStorageFee, emptySignature);
            }

            // 3. 최종 잔액 확인
            const expectedBalance = creditAmount - dailyStorageFee * BigInt(days);
            expect(await storageCreditPool.getBalance(user.address)).to.equal(expectedBalance);
        });

        it("❌ 보관료 부족 시 파일 잠금 시뮬레이션 (잔액 0 달성)", async function () {
            // 1. 크레딧 충전
            const creditAmount = STORAGE_FEE * 5n; // 5일치만 충전
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount);
            await storageCreditPool.connect(user).deposit(creditAmount);

            // 2. 5일간 보관료 차감
            const emptySignature = "0x";
            for (let day = 1; day <= 5; day++) {
                await storageCreditPool.connect(owner).deductCredit(user.address, STORAGE_FEE, emptySignature);
            }

            // 3. 잔액 확인 (0이어야 함)
            expect(await storageCreditPool.getBalance(user.address)).to.equal(0);

            // 4. 추가 차감 시도 (실패해야 함)
            await expect(
                storageCreditPool.connect(owner).deductCredit(user.address, STORAGE_FEE, emptySignature),
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");
        });
    });

    describe("시나리오 5: 에러 핸들링 및 엣지 케이스", function () {
        it("✅ 동시에 여러 사용자가 크레딧 충전/사용 가능해야 함", async function () {
            const user2 = (await ethers.getSigners())[2];
            await mockERC20.transfer(user2.address, INITIAL_SUPPLY / 10n);

            const creditAmount = ethers.parseEther("100");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount);
            await mockERC20.connect(user2).approve(await storageCreditPool.getAddress(), creditAmount);

            // 동시에 크레딧 충전
            await Promise.all([
                storageCreditPool.connect(user).deposit(creditAmount),
                storageCreditPool.connect(user2).deposit(creditAmount),
            ]);

            expect(await storageCreditPool.getBalance(user.address)).to.equal(creditAmount);
            expect(await storageCreditPool.getBalance(user2.address)).to.equal(creditAmount);
            expect(await storageCreditPool.getTotalLocked()).to.equal(creditAmount * 2n);
        });

        it("✅ 정확한 금액 계산이 이루어져야 함", async function () {
            const creditAmount = ethers.parseEther("100.123456");
            await mockERC20.connect(user).approve(await storageCreditPool.getAddress(), creditAmount);
            await storageCreditPool.connect(user).deposit(creditAmount);

            const fee = ethers.parseEther("10.123456");
            const emptySignature = "0x";
            await storageCreditPool.connect(owner).deductCredit(user.address, fee, emptySignature);

            const expectedBalance = creditAmount - fee;
            expect(await storageCreditPool.getBalance(user.address)).to.equal(expectedBalance);
        });
    });
});

