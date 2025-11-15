import { listenForCreditDeposits } from "@/services/blockchain";
import { updateCreditBalance } from "@/services/credit";
import { ethers } from "ethers";

/**
 * Start listening for contract events
 */
export function startEventListeners(): void {
    console.log("Starting contract event listeners...");

    listenForCreditDeposits(async (walletId: string, amount: bigint) => {
        try {
            console.log(`CreditDeposited event: wallet=${walletId}, amount=${amount.toString()}`);
            await updateCreditBalance(walletId, amount);
            console.log(`Updated credit balance for wallet ${walletId}`);
        } catch (error) {
            console.error("Error processing CreditDeposited event:", error);
        }
    });

    console.log("Contract event listeners started");
}

/**
 * Stop listening for contract events
 */
export function stopEventListeners(): void {
    // Note: ethers.js doesn't provide a direct way to stop listeners
    // In production, you might want to implement a more sophisticated event listener
    // that can be stopped gracefully
    console.log("Stopping contract event listeners...");
}

