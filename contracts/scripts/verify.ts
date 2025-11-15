import * as fs from "fs";
import { run } from "hardhat";
import * as path from "path";

async function main() {
    const deploymentsDir = path.join(__dirname, "../deployments");
    const addressesPath = path.join(deploymentsDir, "addresses.json");

    if (!fs.existsSync(addressesPath)) {
        throw new Error("Deployment addresses file not found. Please run deploy.ts first.");
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    console.log("Verifying contracts on", deploymentInfo.network);
    console.log("Chain ID:", deploymentInfo.chainId);

    // 환경 변수에서 결제 토큰 주소 가져오기
    const paymentTokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;
    if (!paymentTokenAddress) {
        throw new Error("PAYMENT_TOKEN_ADDRESS environment variable is not set");
    }

    try {
        // StorageCreditPool 검증
        console.log("\nVerifying StorageCreditPool...");
        await run("verify:verify", {
            address: deploymentInfo.contracts.StorageCreditPool.address,
            constructorArguments: [paymentTokenAddress],
        });
        console.log("StorageCreditPool verified successfully!");
    } catch (error: any) {
        if (error.message.includes("Already Verified")) {
            console.log("StorageCreditPool is already verified");
        } else {
            console.error("Error verifying StorageCreditPool:", error.message);
        }
    }

    try {
        // PaymentContract 검증
        console.log("\nVerifying PaymentContract...");
        await run("verify:verify", {
            address: deploymentInfo.contracts.PaymentContract.address,
            constructorArguments: [paymentTokenAddress],
        });
        console.log("PaymentContract verified successfully!");
    } catch (error: any) {
        if (error.message.includes("Already Verified")) {
            console.log("PaymentContract is already verified");
        } else {
            console.error("Error verifying PaymentContract:", error.message);
        }
    }

    console.log("\n=== Verification Complete ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

