import * as fs from "fs";
import hre from "hardhat";
import * as path from "path";

async function main() {
    const { ethers } = hre as any;
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 환경 변수에서 결제 토큰 주소 가져오기 (예: USDC)
    const paymentTokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;
    if (!paymentTokenAddress) {
        throw new Error("PAYMENT_TOKEN_ADDRESS environment variable is not set");
    }

    console.log("Payment Token Address:", paymentTokenAddress);

    // StorageCreditPool 배포
    console.log("\nDeploying StorageCreditPool...");
    const StorageCreditPool = await ethers.getContractFactory("StorageCreditPool");
    const storageCreditPool = await StorageCreditPool.deploy(paymentTokenAddress);
    await storageCreditPool.waitForDeployment();
    const storageCreditPoolAddress = await storageCreditPool.getAddress();
    console.log("StorageCreditPool deployed to:", storageCreditPoolAddress);

    // PaymentContract 배포
    console.log("\nDeploying PaymentContract...");
    const PaymentContract = await ethers.getContractFactory("PaymentContract");
    const paymentContract = await PaymentContract.deploy(paymentTokenAddress);
    await paymentContract.waitForDeployment();
    const paymentContractAddress = await paymentContract.getAddress();
    console.log("PaymentContract deployed to:", paymentContractAddress);

    // 네트워크 정보 가져오기
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    // 배포 정보 저장
    const deploymentInfo = {
        chainId: chainId.toString(),
        network: network.name,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            StorageCreditPool: {
                address: storageCreditPoolAddress,
                paymentToken: paymentTokenAddress,
            },
            PaymentContract: {
                address: paymentContractAddress,
                paymentToken: paymentTokenAddress,
            },
        },
    };

    // deployments 디렉토리 생성
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // addresses.json 파일에 저장
    const addressesPath = path.join(deploymentsDir, "addresses.json");
    fs.writeFileSync(addressesPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\nDeployment information saved to:", addressesPath);
    console.log("\n=== Deployment Summary ===");
    console.log("Chain ID:", chainId);
    console.log("Network:", network.name);
    console.log("StorageCreditPool:", storageCreditPoolAddress);
    console.log("PaymentContract:", paymentContractAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

