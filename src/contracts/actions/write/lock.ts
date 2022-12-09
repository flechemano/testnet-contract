import { PstAction, IOState, ContractResult } from "../../types/types";

declare const ContractError;
declare const SmartWeave: any;

// Locks tokens into a community staker owned vault
export const lock = async (
  state: IOState,
  { caller, input: { qty, lockLength } }: PstAction
): Promise<ContractResult> => {
  const balances = state.balances;
  const settings = state.settings;
  const vaults = state.vaults;

  if (!Number.isInteger(qty) || qty <= 0) {
    throw new ContractError("Quantity must be a positive integer.");
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
      `Caller balance not high enough to send ${qty} token(s)!`
    );
  }

  const start = +SmartWeave.block.height;
  const end = start + lockLength;
  state.balances[caller] -= qty;
  if (caller in vaults) {
    state.vaults[caller].push({
      balance: qty,
      end,
      start,
    });
  } else {
    state.vaults[caller] = [
      {
        balance: qty,
        end,
        start,
      },
    ];
  }
  return { state };
};
