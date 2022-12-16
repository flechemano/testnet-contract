import { isArweaveAddress } from "@/contracts/utilities";
import { PstAction, IOState, ContractResult } from "../../types/types";

declare const ContractError;
declare const SmartWeave: any;

// transfers tokens directly to a locked vault owned by the recipient
export const transferTokensLocked = async (
  state: IOState,
  { caller, input: { target, qty, lockLength } }: PstAction
): Promise<ContractResult> => {
  target = isArweaveAddress(target);
  const balances = state.balances;
  const settings = state.settings;
  const vaults = state.vaults;

  if (!Number.isInteger(qty)) {
    throw new ContractError('Invalid value for "qty". Must be an integer');
  }

  if (!target) {
    throw new ContractError("No target specified");
  }

  if (qty <= 0 || caller === target) {
    throw new ContractError("Invalid token transfer");
  }

  if (
    !balances[caller] ||
    balances[caller] == undefined ||
    balances[caller] == null ||
    isNaN(balances[caller])
  ) {
    throw new ContractError(`Caller balance is not defined!`);
  }

  if (balances[caller] < qty) {
    throw new ContractError(
      `Caller balance not high enough to send ${qty} locked token(s)!`
    );
  }

  if (
    !Number.isInteger(lockLength) ||
    lockLength < settings["lockMinLength"] ||
    lockLength > settings["lockMaxLength"]
  ) {
    throw new ContractError(
      `lockLength is out of range. lockLength must be between ${settings["lockMinLength"]} - ${settings["lockMaxLength"]}.`
    );
  }

  const start = +SmartWeave.block.height;
  const end = start + lockLength;
  balances[caller] -= qty;
  if (target in vaults) {
    // Wallet already exists in state, add new tokens
    state.vaults[target].push({
      balance: qty,
      end,
      start,
    });
  } else {
    // Wallet is new, set starting balance
    state.vaults[target] = [
      {
        balance: qty,
        end,
        start,
      },
    ];
  }

  return { state };
};
